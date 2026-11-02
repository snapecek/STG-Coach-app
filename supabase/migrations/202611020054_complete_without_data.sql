-- Allow explicit completion without supplying missing event data.
create or replace function public.event_completion_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' and (new.starts_at,new.duration_minutes,new.name,new.place,new.type,new.plan,new.actual_notes,new.status,new.event_kind,new.race_distance_km,new.race_registration_url) is distinct from (old.starts_at,old.duration_minutes,old.name,old.place,old.type,old.plan,old.actual_notes,old.status,old.event_kind,old.race_distance_km,old.race_registration_url) then new.completed_at:=null;new.completed_by:=null;end if;
 if new.status='cancelled' then new.completed_at:=null;new.completed_by:=null;end if;
 if new.completed_at is not null and (tg_op='INSERT' or old.completed_at is distinct from new.completed_at) then
  if new.starts_at+make_interval(mins=>new.duration_minutes)>now() then raise exception 'Událost ještě neskončila.';end if;
  if not (coalesce(current_setting('app.complete_without_data',true),'')=new.id::text and public.has_club_role(new.club_id,array['owner','coach'])) then
  if new.event_kind='race' then
   if not exists(select 1 from public.participation p join public.members m on m.id=p.member_id and m.club_id=p.club_id where p.event_id=new.id) or exists(
    select 1 from public.participation p join public.members m on m.id=p.member_id and m.club_id=p.club_id left join public.race_results r on r.event_id=p.event_id and r.member_id=p.member_id
    where p.event_id=new.id and (p.attended is null or (p.response is distinct from 'companion' and (r.member_id is null or (r.status='dns' and p.attended is distinct from false) or (r.status in ('finished','dnf') and p.attended is distinct from true))))
   ) then raise exception 'Potvrďte účast a výsledek každého závodníka (DNS = nepřítomen).';end if;
  else
   if length(trim(new.actual_notes))=0 then raise exception 'Doplňte skutečný průběh.';end if;
   if not exists(select 1 from public.participation where event_id=new.id and attended is not null) or exists(
    select 1 from public.members m left join public.participation p on p.member_id=m.id and p.event_id=new.id
    where m.club_id=new.club_id and (not m.event_guest or p.member_id is not null) and (m.removed_at is null or m.removed_at>new.starts_at or p.attended is not null or (new.roster_only and p.member_id is not null)) and (m.purge_after is null or m.purge_after>now()) and (not new.roster_only or p.member_id is not null) and p.attended is null
   ) then raise exception 'Potvrďte docházku všech evidovaných účastníků.';end if;
  end if;
  end if;
  new.completed_at:=now();new.completed_by:=auth.uid();
 end if;
 if new.completed_at is null then new.completed_by:=null;end if;
 return new;
end $$;

create or replace function public.guard_race_team_completion() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.event_kind<>'race' and exists(select 1 from public.race_teams where event_id=new.id) then raise exception 'Nejprve odeberte závodní týmy.';end if;
 if not (coalesce(current_setting('app.complete_without_data',true),'')=new.id::text and public.has_club_role(new.club_id,array['owner','coach'])) and new.event_kind='race' and new.completed_at is not null and exists(select 1 from public.race_teams t where t.event_id=new.id and (t.status is null or not exists(select 1 from public.race_team_members m where m.team_id=t.id) or exists(select 1 from public.race_team_members m join public.participation p on p.event_id=m.event_id and p.member_id=m.member_id where m.team_id=t.id and (p.attended is distinct from (t.status<>'dns') or (p.attendance_excused and t.status<>'dns'))))) then raise exception 'Doplňte týmové výsledky a odpovídající docházku.';end if;
 return new;
end $$;

-- Explicit coach/owner action. No attendance, notes or results are fabricated.
create function public.complete_event_without_data(target_club uuid,target_event uuid)
returns public.events language plpgsql security definer set search_path=public as $$
declare result public.events;previous_setting text;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select * into result from public.events where club_id=target_club and id=target_event for update;
 if not found then raise insufficient_privilege;end if;
 if result.status<>'scheduled' then raise exception 'Zrušenou událost nejdříve obnovte.';end if;
 if result.starts_at+make_interval(mins=>result.duration_minutes)>now() then raise exception 'Událost ještě neskončila.';end if;
 if result.completed_at is not null then return result;end if;
 previous_setting:=coalesce(current_setting('app.complete_without_data',true),'');
 perform set_config('app.complete_without_data',target_event::text,true);
 update public.events set completed_at=now() where id=target_event and club_id=target_club returning * into result;
 perform set_config('app.complete_without_data',previous_setting,true);
 return result;
end $$;
revoke all on function public.complete_event_without_data(uuid,uuid) from public,anon;
grant execute on function public.complete_event_without_data(uuid,uuid) to authenticated;
