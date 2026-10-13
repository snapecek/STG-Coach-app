-- Races have selected entrants and result-based completion, separate from training.
begin;
alter table public.events add column race_distance_km numeric check(race_distance_km>0 and race_distance_km<=1000), add column race_registration_url text not null default '' check(length(race_registration_url)<=1000 and (race_registration_url='' or race_registration_url ~ '^https://[^[:space:]]+$'));
-- Preserve existing notes/results. Only retire the incorrect training-template linkage.
update public.events set completed_at=null,completed_by=null,template_id=null,type=case when type in ('Kondice','Mobilita','Síla') then 'Závod' else type end where event_kind='race';
insert into public.participation(club_id,event_id,member_id)
 select club_id,event_id,member_id from public.race_results on conflict do nothing;
create function public.create_club_race(target_club uuid,race jsonb,entrants uuid[]) returns public.events language plpgsql set search_path=public as $$
declare created public.events;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 if coalesce(cardinality(entrants),0)<1 or cardinality(entrants)>500 or cardinality(entrants)<>(select count(distinct id) from unnest(entrants) id) then raise exception 'Choose 1 to 500 distinct entrants';end if;
 if cardinality(entrants)<>(select count(*) from public.members where club_id=target_club and id=any(entrants) and removed_at is null and (purge_after is null or purge_after>now())) then raise exception 'Entrants must be active members of this club';end if;
 if length(trim(race->>'name')) not between 1 and 80 or length(trim(race->>'place')) not between 1 and 200 or length(trim(race->>'type')) not between 1 and 40 or length(coalesce(race->>'plan',''))>5000 then raise exception 'Invalid race details';end if;
 insert into public.events(id,club_id,name,place,type,plan,starts_at,duration_minutes,event_kind,race_distance_km,race_registration_url)
 values((race->>'id')::uuid,target_club,trim(race->>'name'),trim(race->>'place'),trim(race->>'type'),coalesce(race->>'plan',''),(race->>'starts_at')::timestamptz,(race->>'duration_minutes')::integer,'race',(race->>'race_distance_km')::numeric,coalesce(race->>'race_registration_url','')) returning * into created;
 insert into public.participation(club_id,event_id,member_id) select target_club,created.id,id from unnest(entrants) id;
 return created;
end $$;
revoke all on function public.create_club_race(uuid,jsonb,uuid[]) from public,anon;
grant execute on function public.create_club_race(uuid,jsonb,uuid[]) to authenticated;
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
    where m.club_id=new.club_id and (m.removed_at is null or m.removed_at>new.starts_at or p.member_id is not null) and (m.purge_after is null or m.purge_after>now()) and p.attended is null
   ) then raise exception 'Potvrďte docházku všech evidovaných účastníků.';end if;
  end if;
  new.completed_at:=now();new.completed_by:=auth.uid();
 end if;
 if new.completed_at is null then new.completed_by:=null;end if;
 return new;
end $$;
create or replace function public.guard_race_result() returns trigger language plpgsql set search_path=public as $$
begin
 if not public.has_club_role(new.club_id,array['owner','coach']) then raise insufficient_privilege using message='Staff role required';end if;
 if TG_OP='UPDATE' and (new.club_id,new.event_id,new.member_id) is distinct from (old.club_id,old.event_id,old.member_id) then raise exception 'Result identity cannot change';end if;
 perform 1 from public.events where id=new.event_id and club_id=new.club_id and event_kind='race' and status='scheduled' for update;
 if not found then raise exception 'Results require a scheduled race';end if;
 if not exists(select 1 from public.members where id=new.member_id and club_id=new.club_id) then raise insufficient_privilege;end if;
 if not exists(select 1 from public.participation where event_id=new.event_id and member_id=new.member_id and club_id=new.club_id) then raise exception 'Add this entrant to the race roster first';end if;
 return new;
end $$;
create function public.guard_race_roster_removal() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from public.members where id=old.member_id) and exists(select 1 from public.events where id=old.event_id and event_kind='race') and exists(select 1 from public.race_results where event_id=old.event_id and member_id=old.member_id) then raise exception 'Remove the entrant result before removing the entrant';end if;
 return old;
end $$;
create trigger race_roster_removal before delete on public.participation for each row execute function public.guard_race_roster_removal();
commit;
