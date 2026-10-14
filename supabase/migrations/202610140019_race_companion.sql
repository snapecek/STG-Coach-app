begin;
alter table public.participation drop constraint participation_response_check;
alter table public.participation add constraint participation_response_check check(response in ('yes','no','maybe','companion'));
create function public.guard_race_companion() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.response='companion' then
  perform 1 from public.events where id=new.event_id and club_id=new.club_id and event_kind='race' for update;
  if not found then raise exception 'Doprovod je pouze pro závod.';end if;
  if exists(select 1 from public.race_results where event_id=new.event_id and member_id=new.member_id) or exists(select 1 from public.race_team_members where event_id=new.event_id and member_id=new.member_id) then raise exception 'Nejprve odeberte závodní výsledek a zařazení do týmu.';end if;
 end if;
 return new;
end $$;
create trigger b_race_companion before insert or update on public.participation for each row execute function public.guard_race_companion();
create function public.reject_companion_result() returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform 1 from public.events where id=new.event_id for update;
 if exists(select 1 from public.participation where event_id=new.event_id and member_id=new.member_id and response='companion') then raise exception 'Doprovod nemůže mít závodní výsledek ani být v závodním týmu.';end if;
 return new;
end $$;
create trigger a_companion_result before insert or update on public.race_results for each row execute function public.reject_companion_result();
create trigger a_companion_team before insert or update on public.race_team_members for each row execute function public.reject_companion_result();
revoke all on function public.guard_race_companion(),public.reject_companion_result() from public,anon,authenticated;
create or replace function public.event_completion_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' and (new.starts_at,new.duration_minutes,new.name,new.place,new.type,new.plan,new.actual_notes,new.status,new.event_kind,new.race_distance_km,new.race_registration_url) is distinct from (old.starts_at,old.duration_minutes,old.name,old.place,old.type,old.plan,old.actual_notes,old.status,old.event_kind,old.race_distance_km,old.race_registration_url) then new.completed_at:=null;new.completed_by:=null;end if;
 if new.status='cancelled' then new.completed_at:=null;new.completed_by:=null;end if;
 if new.completed_at is not null and (tg_op='INSERT' or old.completed_at is distinct from new.completed_at) then
  if new.starts_at+make_interval(mins=>new.duration_minutes)>now() then raise exception 'Událost ještě neskončila.';end if;
  if new.event_kind='race' then
   if not exists(select 1 from public.participation p join public.members m on m.id=p.member_id and m.club_id=p.club_id where p.event_id=new.id) or exists(
    select 1 from public.participation p join public.members m on m.id=p.member_id and m.club_id=p.club_id left join public.race_results r on r.event_id=p.event_id and r.member_id=p.member_id
    where p.event_id=new.id and (p.attended is null or (p.response is distinct from 'companion' and (r.member_id is null or (r.status='dns' and p.attended is distinct from false) or (r.status in ('finished','dnf') and p.attended is distinct from true))))
   ) then raise exception 'Potvrďte účast a výsledek každého závodníka (DNS = nepřítomen).';end if;
  else
   if length(trim(new.actual_notes))=0 then raise exception 'Doplňte skutečný průběh.';end if;
   if not exists(select 1 from public.participation where event_id=new.id and attended is not null) or exists(
    select 1 from public.members m left join public.participation p on p.member_id=m.id and p.event_id=new.id
    where m.club_id=new.club_id and (m.removed_at is null or m.removed_at>new.starts_at or p.attended is not null or (new.roster_only and p.member_id is not null)) and (m.purge_after is null or m.purge_after>now()) and (not new.roster_only or p.member_id is not null) and p.attended is null
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
 if answer is null or answer not in ('yes','no','maybe','companion') then raise exception 'Invalid response';end if;
 select * into m from public.members where club_id=target_club and user_id=auth.uid() and removed_at is null and (purge_after is null or purge_after>now()) for update;
 if not found then raise exception 'No linked active member';end if;
 select * into e from public.events where id=target_event and club_id=target_club for update;
 if not found or e.status<>'scheduled' or e.starts_at<=now() or e.completed_at is not null then raise exception 'RSVP closed';end if;
 if answer='companion' and e.event_kind<>'race' then raise exception 'Doprovod je pouze pro závod.';end if;
 if (e.event_kind='race' or e.roster_only) and not exists(select 1 from public.participation where event_id=e.id and member_id=m.id) then raise exception 'Not on this event roster';end if;
 insert into public.participation(club_id,event_id,member_id,response) values(target_club,e.id,m.id,answer) on conflict(event_id,member_id) do update set response=excluded.response;
 select * into result from public.participation where event_id=e.id and member_id=m.id;
 return result;
end $$;
create function public.guard_companion_event_kind() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.event_kind<>'race' and exists(select 1 from public.participation where event_id=new.id and response='companion') then raise exception 'Událost s doprovodem musí zůstat závodem.';end if;
 return new;
end $$;
create trigger a_companion_event_kind before update of event_kind on public.events for each row execute function public.guard_companion_event_kind();
revoke all on function public.guard_companion_event_kind() from public,anon,authenticated;
commit;
