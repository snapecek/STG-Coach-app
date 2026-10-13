begin;
-- Only newly created repeated trainings are linked. Never infer old series from names.
alter table public.events add column series_id uuid,
 add constraint training_series_only check(event_kind='training' or series_id is null);
create function public.guard_training_series_identity() returns trigger language plpgsql set search_path=public as $$
begin if new.series_id is distinct from old.series_id then raise exception 'Series identity cannot change';end if;return new;end $$;
create trigger a_series_identity before update on public.events for each row execute function public.guard_training_series_identity();
create function public.create_training_series(target_club uuid,sessions jsonb) returns setof public.events language plpgsql set search_path=public as $$
declare s jsonb;e public.events;sid uuid;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 if sessions is null or jsonb_typeof(sessions)<>'array' or jsonb_array_length(sessions) not between 1 and 12 then raise exception 'Choose 1 to 12 trainings';end if;
 if jsonb_array_length(sessions)>1 then sid:=gen_random_uuid();end if;
 for s in select value from jsonb_array_elements(sessions) loop
 if s->>'name' is null or length(trim(s->>'name')) not between 1 and 80 or s->>'place' is null or length(trim(s->>'place')) not between 1 and 200 or s->>'type' is null or length(trim(s->>'type')) not between 1 and 40 or length(coalesce(s->>'plan',''))>5000 then raise exception 'Invalid training details';end if;
 insert into public.events(id,club_id,template_id,name,place,type,plan,starts_at,duration_minutes,capacity,event_kind,series_id)
 values((s->>'id')::uuid,target_club,(s->>'template_id')::uuid,trim(s->>'name'),trim(s->>'place'),trim(s->>'type'),coalesce(s->>'plan',''),(s->>'starts_at')::timestamptz,(s->>'duration_minutes')::integer,(s->>'capacity')::integer,'training',sid) returning * into e;
 return next e;
 end loop;
end $$;
create or replace function public.create_group_trainings(target_club uuid,target_group uuid,sessions jsonb) returns setof public.events
 language plpgsql set search_path=public as $$
declare g public.training_groups;s jsonb;e public.events;entrants uuid[];sid uuid;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select * into g from public.training_groups where club_id=target_club and id=target_group and archived_at is null for update;
 if not found then raise exception 'Active group required';end if;
 if sessions is null or jsonb_typeof(sessions)<>'array' or jsonb_array_length(sessions) not between 1 and 12 then raise exception 'Choose 1 to 12 sessions';end if;
 if jsonb_array_length(sessions)>1 then sid:=gen_random_uuid();end if;
 perform m.id from public.members m join public.training_group_members gm on gm.member_id=m.id and gm.club_id=m.club_id
 where gm.group_id=g.id and m.removed_at is null and (m.purge_after is null or m.purge_after>now()) order by m.id for share of m;
 select array_agg(m.id order by m.id) into entrants from public.members m join public.training_group_members gm on gm.member_id=m.id and gm.club_id=m.club_id
 where gm.group_id=g.id and m.removed_at is null and (m.purge_after is null or m.purge_after>now());
 if coalesce(cardinality(entrants),0) not between 1 and 500 then raise exception 'Group needs 1 to 500 active members';end if;
 for s in select value from jsonb_array_elements(sessions) loop
 if s->>'name' is null or length(trim(s->>'name')) not between 1 and 80 or s->>'place' is null or length(trim(s->>'place')) not between 1 and 200 or s->>'type' is null or length(trim(s->>'type')) not between 1 and 40 or length(coalesce(s->>'plan',''))>5000 then raise exception 'Invalid training details';end if;
 insert into public.events(id,club_id,template_id,name,place,type,plan,starts_at,duration_minutes,capacity,event_kind,source_group_id,group_name,roster_only,series_id)
 values((s->>'id')::uuid,target_club,(s->>'template_id')::uuid,trim(s->>'name'),trim(s->>'place'),trim(s->>'type'),coalesce(s->>'plan',''),(s->>'starts_at')::timestamptz,(s->>'duration_minutes')::integer,(s->>'capacity')::integer,'training',g.id,g.name,true,sid) returning * into e;
 insert into public.participation(club_id,event_id,member_id) select target_club,e.id,id from unnest(entrants)id;
 return next e;
 end loop;
end $$;
create function public.change_training_series(target_club uuid,target_series uuid,action text,changes jsonb) returns setof public.events
 language plpgsql set search_path=public as $$
declare c jsonb;e public.events;eligible uuid[];supplied uuid[];
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 if target_series is null or action not in ('reschedule','cancel','restore') or action is null or changes is null or jsonb_typeof(changes)<>'array' or jsonb_array_length(changes) not between 1 and 12 then raise exception 'Invalid series change';end if;
 -- Lock the existing series in deterministic order before checking the reviewed snapshot.
 perform id from public.events where club_id=target_club and series_id=target_series order by id for update;
 select array_agg(id order by id) into eligible from public.events where club_id=target_club and series_id=target_series and event_kind='training' and starts_at>clock_timestamp() and completed_at is null and status=case when action='restore' then 'cancelled' else 'scheduled' end;
 select array_agg((value->>'id')::uuid order by (value->>'id')::uuid) into supplied from jsonb_array_elements(changes);
 if eligible is null or supplied is distinct from eligible then raise exception 'Series changed; reload the preview';end if;
 for c in select value from jsonb_array_elements(changes) loop
 select * into e from public.events where club_id=target_club and series_id=target_series and id=(c->>'id')::uuid;
 if e.starts_at<=clock_timestamp() then raise exception 'Training already started; reload the preview';end if;
 if (e.starts_at,e.status) is distinct from ((c->>'expected_starts_at')::timestamptz,c->>'expected_status') then raise exception 'Series changed; reload the preview';end if;
 if action='reschedule' then
 if c->>'starts_at' is null or not isfinite((c->>'starts_at')::timestamptz) or (c->>'starts_at')::timestamptz<=clock_timestamp() then raise exception 'New training time must be in the future';end if;
 update public.events set starts_at=(c->>'starts_at')::timestamptz where id=e.id returning * into e;
 else
 update public.events set status=case when action='cancel' then 'cancelled' else 'scheduled' end where id=e.id returning * into e;
 end if;
 return next e;
 end loop;
end $$;
revoke all on function public.guard_training_series_identity(),public.create_training_series(uuid,jsonb),public.change_training_series(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.create_training_series(uuid,jsonb),public.change_training_series(uuid,uuid,text,jsonb) to authenticated;
commit;
