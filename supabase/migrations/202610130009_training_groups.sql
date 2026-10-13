begin;
create table public.training_groups(
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs on delete cascade,
 name text not null check(length(trim(name)) between 1 and 80),
 description text not null default '' check(length(description)<=1000),archived_at timestamptz,
 unique(club_id,id)
);
create table public.training_group_members(
 club_id uuid not null,group_id uuid not null,member_id uuid not null,
 primary key(group_id,member_id),
 foreign key(club_id,group_id) references public.training_groups(club_id,id) on delete cascade,
 foreign key(club_id,member_id) references public.members(club_id,id) on delete cascade
);
alter table public.training_groups enable row level security;
alter table public.training_group_members enable row level security;
revoke all on public.training_groups,public.training_group_members from public,anon,authenticated;
grant select,insert,update on public.training_groups to authenticated;
grant select,insert,delete on public.training_group_members to authenticated;
create policy groups_staff on public.training_groups for all to authenticated
 using(public.has_club_role(club_id,array['owner','coach'])) with check(public.has_club_role(club_id,array['owner','coach']));
create policy group_members_staff on public.training_group_members for all to authenticated
 using(public.has_club_role(club_id,array['owner','coach']) and exists(select 1 from public.members m where m.id=member_id and m.club_id=training_group_members.club_id))
 with check(public.has_club_role(club_id,array['owner','coach']) and exists(select 1 from public.members m where m.id=member_id and m.club_id=training_group_members.club_id));
alter table public.events add column source_group_id uuid,add column group_name text not null default '',add column roster_only boolean not null default false,
 add foreign key(club_id,source_group_id) references public.training_groups(club_id,id) on delete set null(source_group_id),
 add constraint group_training_scope check(not roster_only or (event_kind='training' and length(trim(group_name)) between 1 and 80));
create function public.guard_group_event_audience() returns trigger language plpgsql set search_path=public as $$
begin
 if new.roster_only is distinct from old.roster_only or new.group_name is distinct from old.group_name then raise exception 'Event audience snapshot cannot change';end if;
 if old.roster_only and new.event_kind<>'training' then raise exception 'Group training cannot become a race';end if;
 return new;
end $$;
create trigger a_group_audience before update on public.events for each row execute function public.guard_group_event_audience();
create function public.save_training_group(target_club uuid,target_group uuid,label text,details text,entrants uuid[]) returns public.training_groups
 language plpgsql set search_path=public as $$
declare g public.training_groups;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 if label is null or length(trim(label)) not between 1 and 80 or length(coalesce(details,''))>1000 then raise exception 'Invalid group details';end if;
 if entrants is null or cardinality(entrants)>500 or cardinality(entrants)<>(select count(distinct id) from unnest(entrants)id) then raise exception 'Choose at most 500 distinct members';end if;
 if cardinality(entrants)<>(select count(*) from public.members where club_id=target_club and id=any(entrants) and removed_at is null and (purge_after is null or purge_after>now())) then raise exception 'Group members must be active in this club';end if;
 select * into g from public.training_groups where club_id=target_club and id=target_group for update;
 if found then
 if g.archived_at is not null then raise exception 'Restore the group before editing';end if;
 update public.training_groups set name=trim(label),description=coalesce(details,'') where club_id=target_club and id=target_group returning * into g;
 else
 insert into public.training_groups(id,club_id,name,description) values(target_group,target_club,trim(label),coalesce(details,'')) returning * into g;
 end if;
 delete from public.training_group_members where club_id=target_club and group_id=g.id;
 insert into public.training_group_members(club_id,group_id,member_id) select target_club,g.id,id from unnest(entrants)id;
 return g;
end $$;
create function public.archive_training_group(target_club uuid,target_group uuid,restore boolean default false) returns public.training_groups
 language plpgsql set search_path=public as $$
declare g public.training_groups;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 update public.training_groups set archived_at=case when restore then null else coalesce(archived_at,now()) end
 where club_id=target_club and id=target_group returning * into g;
 if not found then raise exception 'Group unavailable';end if;
 return g;
end $$;
create function public.create_group_trainings(target_club uuid,target_group uuid,sessions jsonb) returns setof public.events
 language plpgsql set search_path=public as $$
declare g public.training_groups;s jsonb;e public.events;entrants uuid[];
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select * into g from public.training_groups where club_id=target_club and id=target_group and archived_at is null for update;
 if not found then raise exception 'Active group required';end if;
 if sessions is null or jsonb_typeof(sessions)<>'array' or jsonb_array_length(sessions) not between 1 and 12 then raise exception 'Choose 1 to 12 sessions';end if;
 perform m.id from public.members m join public.training_group_members gm on gm.member_id=m.id and gm.club_id=m.club_id
 where gm.group_id=g.id and m.removed_at is null and (m.purge_after is null or m.purge_after>now()) order by m.id for share of m;
 select array_agg(m.id order by m.id) into entrants from public.members m join public.training_group_members gm on gm.member_id=m.id and gm.club_id=m.club_id
 where gm.group_id=g.id and m.removed_at is null and (m.purge_after is null or m.purge_after>now());
 if coalesce(cardinality(entrants),0) not between 1 and 500 then raise exception 'Group needs 1 to 500 active members';end if;
 for s in select value from jsonb_array_elements(sessions) loop
 if s->>'name' is null or length(trim(s->>'name')) not between 1 and 80 or s->>'place' is null or length(trim(s->>'place')) not between 1 and 200 or s->>'type' is null or length(trim(s->>'type')) not between 1 and 40 or length(coalesce(s->>'plan',''))>5000 then raise exception 'Invalid training details';end if;
 insert into public.events(id,club_id,template_id,name,place,type,plan,starts_at,duration_minutes,capacity,event_kind,source_group_id,group_name,roster_only)
 values((s->>'id')::uuid,target_club,(s->>'template_id')::uuid,trim(s->>'name'),trim(s->>'place'),trim(s->>'type'),coalesce(s->>'plan',''),(s->>'starts_at')::timestamptz,(s->>'duration_minutes')::integer,(s->>'capacity')::integer,'training',g.id,g.name,true) returning * into e;
 insert into public.participation(club_id,event_id,member_id) select target_club,e.id,id from unnest(entrants)id;
 return next e;
 end loop;
end $$;
-- Do not reveal another group's events, race roster or member identities to members.
create function public.can_read_club_event(target_club uuid,target_event uuid) returns boolean
 language sql stable security definer set search_path=public as $$
 select public.has_club_role(target_club,array['owner','coach','member']) and exists(
 select 1 from public.events e where e.id=target_event and e.club_id=target_club and (
 (e.event_kind='training' and not e.roster_only) or exists(
 select 1 from public.participation p join public.members m on m.id=p.member_id and m.club_id=p.club_id
 where p.event_id=e.id and m.user_id=auth.uid() and m.removed_at is null and (m.purge_after is null or m.purge_after>now())
 )));
$$;
drop policy events_read on public.events;
create policy events_read on public.events for select to authenticated using(public.can_read_club_event(club_id,id));
revoke all on function public.guard_group_event_audience(),public.save_training_group(uuid,uuid,text,text,uuid[]),public.archive_training_group(uuid,uuid,boolean),public.create_group_trainings(uuid,uuid,jsonb),public.can_read_club_event(uuid,uuid) from public,anon;
grant execute on function public.save_training_group(uuid,uuid,text,text,uuid[]),public.archive_training_group(uuid,uuid,boolean),public.create_group_trainings(uuid,uuid,jsonb),public.can_read_club_event(uuid,uuid) to authenticated;
create or replace function public.event_completion_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' and (new.starts_at,new.duration_minutes,new.name,new.place,new.type,new.plan,new.actual_notes,new.status,new.event_kind,new.race_distance_km,new.race_registration_url) is distinct from (old.starts_at,old.duration_minutes,old.name,old.place,old.type,old.plan,old.actual_notes,old.status,old.event_kind,old.race_distance_km,old.race_registration_url) then new.completed_at:=null;new.completed_by:=null;end if;
 if new.status='cancelled' then new.completed_at:=null;new.completed_by:=null;end if;
 if new.completed_at is not null and (tg_op='INSERT' or old.completed_at is distinct from new.completed_at) then
  if new.starts_at+make_interval(mins=>new.duration_minutes)>now() then raise exception 'Událost ještě neskončila.';end if;
  if new.event_kind='race' then
   if not exists(select 1 from public.participation p join public.members m on m.id=p.member_id and m.club_id=p.club_id where p.event_id=new.id) or exists(
    select 1 from public.participation p join public.members m on m.id=p.member_id and m.club_id=p.club_id left join public.race_results r on r.event_id=p.event_id and r.member_id=p.member_id
    where p.event_id=new.id and (p.attended is null or r.member_id is null or (r.status='dns' and p.attended is distinct from false) or (r.status in ('finished','dnf') and p.attended is distinct from true))
   ) then raise exception 'Potvrďte účast a výsledek každého závodníka (DNS = nepřítomen).';end if;
  else
   if length(trim(new.actual_notes))=0 then raise exception 'Doplňte skutečný průběh.';end if;
   if not exists(select 1 from public.participation where event_id=new.id and attended is not null) or exists(
    select 1 from public.members m left join public.participation p on p.member_id=m.id and p.event_id=new.id
    where m.club_id=new.club_id and (m.removed_at is null or m.removed_at>new.starts_at or p.member_id is not null) and (m.purge_after is null or m.purge_after>now()) and (not new.roster_only or p.member_id is not null) and p.attended is null
   ) then raise exception 'Potvrďte docházku všech evidovaných účastníků.';end if;
  end if;
  new.completed_at:=now();new.completed_by:=auth.uid();
 end if;
 if new.completed_at is null then new.completed_by:=null;end if;
 return new;
end $$;
create or replace function public.respond_to_club_event(target_club uuid,target_event uuid,answer text) returns public.participation language plpgsql security definer set search_path=public as $$
declare m public.members;e public.events;result public.participation;
begin
 if not public.has_club_role(target_club,array['owner','coach','member']) then raise insufficient_privilege;end if;
 if answer is null or answer not in ('yes','no','maybe') then raise exception 'Invalid response';end if;
 select * into m from public.members where club_id=target_club and user_id=auth.uid() and removed_at is null and (purge_after is null or purge_after>now()) for update;
 if not found then raise exception 'No linked active member';end if;
 select * into e from public.events where id=target_event and club_id=target_club for update;
 if not found or e.status<>'scheduled' or e.starts_at<=now() or e.completed_at is not null then raise exception 'RSVP closed';end if;
 if (e.event_kind='race' or e.roster_only) and not exists(select 1 from public.participation where event_id=e.id and member_id=m.id) then raise exception 'Not on this event roster';end if;
 insert into public.participation(club_id,event_id,member_id,response) values(target_club,e.id,m.id,answer) on conflict(event_id,member_id) do update set response=excluded.response;
 select * into result from public.participation where event_id=e.id and member_id=m.id;
 return result;
end $$;
commit;
