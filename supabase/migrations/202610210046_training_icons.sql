-- Decorative training icon snapshot. Existing RLS and write roles are unchanged.
begin;
alter table public.templates add column training_icon text check(training_icon in ('running','medal','fencing','stopwatch','swimming','dumbbell','archery','wrestling','nutrition','bench-press','cycling','hurdles','throwing','tennis','rowing-pair','football','high-jump','hurdle-jump','shot-put','track','pool','stadium','martial-arts','weightlifting','skipping','road-cycling','diving','rowing','gym-bag','whistle','rugby','water-polo','gymnastics','bench','golf','table-tennis','steeplechase','hiking','podium','equestrian','none'));
alter table public.events add column training_icon text check(training_icon in ('running','medal','fencing','stopwatch','swimming','dumbbell','archery','wrestling','nutrition','bench-press','cycling','hurdles','throwing','tennis','rowing-pair','football','high-jump','hurdle-jump','shot-put','track','pool','stadium','martial-arts','weightlifting','skipping','road-cycling','diving','rowing','gym-bag','whistle','rugby','water-polo','gymnastics','bench','golf','table-tennis','steeplechase','hiking','podium','equestrian','none'));
-- Invoker rights: a template can only be read through its existing RLS.
-- Always include club_id even though the template UUID is globally unique.
create function public.snapshot_training_icon() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.event_kind='race' then new.training_icon:=null;return new;end if;
 if tg_op='INSERT' then
  if new.training_icon is null and new.template_id is not null then
   select t.training_icon into new.training_icon from templates t where t.club_id=new.club_id and t.id=new.template_id;
  end if;
 elsif new.template_id is not null and (new.template_id is distinct from old.template_id or new.club_id is distinct from old.club_id) then
  select t.training_icon into new.training_icon from templates t where t.club_id=new.club_id and t.id=new.template_id;
 end if;
 -- ON DELETE SET NULL must preserve the already copied icon.
 return new;
end $$;
revoke all on function public.snapshot_training_icon() from public,anon,authenticated;
create trigger training_icon_snapshot before insert or update on public.events for each row execute function public.snapshot_training_icon();
create or replace function public.create_training_series(target_club uuid,sessions jsonb) returns setof public.events language plpgsql set search_path=public as $$
declare s jsonb;e public.events;sid uuid;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 if sessions is null or jsonb_typeof(sessions)<>'array' or jsonb_array_length(sessions) not between 1 and 12 then raise exception 'Choose 1 to 12 trainings';end if;
 if jsonb_array_length(sessions)>1 then sid:=gen_random_uuid();end if;
 for s in select value from jsonb_array_elements(sessions) loop
 if s->>'name' is null or length(trim(s->>'name')) not between 1 and 80 or s->>'place' is null or length(trim(s->>'place')) not between 1 and 200 or s->>'type' is null or length(trim(s->>'type')) not between 1 and 40 or length(coalesce(s->>'plan',''))>5000 then raise exception 'Invalid training details';end if;
 insert into public.events(id,club_id,template_id,name,place,type,plan,starts_at,duration_minutes,capacity,event_kind,training_icon,event_location,series_id)
 values((s->>'id')::uuid,target_club,(s->>'template_id')::uuid,trim(s->>'name'),trim(s->>'place'),trim(s->>'type'),coalesce(s->>'plan',''),(s->>'starts_at')::timestamptz,(s->>'duration_minutes')::integer,(s->>'capacity')::integer,'training',nullif(s->>'training_icon',''),nullif(s->'event_location','null'::jsonb),sid) returning * into e;
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
 insert into public.events(id,club_id,template_id,name,place,type,plan,starts_at,duration_minutes,capacity,event_kind,training_icon,event_location,source_group_id,group_name,roster_only,series_id)
 values((s->>'id')::uuid,target_club,(s->>'template_id')::uuid,trim(s->>'name'),trim(s->>'place'),trim(s->>'type'),coalesce(s->>'plan',''),(s->>'starts_at')::timestamptz,(s->>'duration_minutes')::integer,(s->>'capacity')::integer,'training',nullif(s->>'training_icon',''),nullif(s->'event_location','null'::jsonb),g.id,g.name,true,sid) returning * into e;
 insert into public.participation(club_id,event_id,member_id) select target_club,e.id,id from unnest(entrants)id;
 return next e;
 end loop;
end $$;


commit;
