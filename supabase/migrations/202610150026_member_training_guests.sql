begin;
alter table public.members add column event_guest boolean not null default false,add column event_guest_of uuid,add foreign key(club_id,event_guest_of) references public.members(club_id,id) on delete set null(event_guest_of),add check(not event_guest or (kind='guest' and user_id is null));
create unique index own_guest_identity on public.members(club_id,event_guest_of,lower(trim(name))) where event_guest and removed_at is null;
create function public.my_training_guests(target_club uuid,target_event uuid) returns table(member_id uuid,name text,seat_status text) language plpgsql stable security definer set search_path=public as $$declare own_id uuid;begin
 if not public.can_use_club_communication(target_club,target_event) then raise insufficient_privilege;end if;
 select id into own_id from members where club_id=target_club and user_id=auth.uid() and removed_at is null and (purge_after is null or purge_after>now());
 if own_id is null then raise insufficient_privilege;end if;
 return query select g.id,g.name,p.seat_status from members g join participation p on p.member_id=g.id and p.club_id=g.club_id where g.club_id=target_club and g.event_guest and g.event_guest_of=own_id and p.event_id=target_event order by g.name,g.id;
end $$;
create function public.invite_training_guest(target_club uuid,target_event uuid,guest_name text) returns uuid language plpgsql security definer set search_path=public as $$declare own_id uuid;e events;g uuid;guest_removed timestamptz;guest_purge timestamptz;begin
 if not public.can_use_club_communication(target_club,target_event) then raise insufficient_privilege;end if;
 select id into own_id from members where club_id=target_club and user_id=auth.uid() and removed_at is null and (purge_after is null or purge_after>now());
 if own_id is null then raise insufficient_privilege;end if;
 select * into e from events where id=target_event and club_id=target_club for update;
 if not found or e.event_kind<>'training' or e.status<>'scheduled' or e.starts_at<=now() or e.completed_at is not null then raise exception 'Guest registration closed';end if;
 if not exists(select 1 from participation where club_id=target_club and event_id=target_event and member_id=own_id and response='yes') then raise exception 'Confirm your attendance first';end if;
 guest_name:=regexp_replace(trim(guest_name),'[[:space:]]+',' ','g');
 if guest_name is null or length(trim(guest_name)) not between 1 and 80 or guest_name !~ '[^[:space:]]' then raise exception 'Invalid guest name';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_club::text||own_id::text||lower(trim(guest_name)),0));
 select id,removed_at,purge_after into g,guest_removed,guest_purge from members where club_id=target_club and event_guest_of=own_id and event_guest and lower(trim(name))=lower(trim(guest_name)) order by (removed_at is null) desc,id limit 1 for update;
 if g is not null and (guest_removed is not null or guest_purge<=now()) then raise exception 'Guest archived';end if;
 if g is not null and exists(select 1 from participation where event_id=target_event and member_id=g) then return g;end if;
 if (select count(*) from members x join participation p on p.member_id=x.id and p.club_id=x.club_id where x.club_id=target_club and x.event_guest_of=own_id and x.event_guest and p.event_id=target_event)>=5 then raise exception 'Maximum five guests';end if;
 if g is null then insert into members(club_id,name,kind,event_guest,event_guest_of) values(target_club,trim(guest_name),'guest',true,own_id) returning id into g;end if;
 insert into participation(club_id,event_id,member_id,response) values(target_club,target_event,g,'yes') on conflict(event_id,member_id) do nothing;
 return g;
end $$;
create function public.withdraw_training_guest(target_club uuid,target_event uuid,guest_id uuid) returns void language plpgsql security definer set search_path=public as $$declare own_id uuid;e events;begin
 if not public.can_use_club_communication(target_club,target_event) then raise insufficient_privilege;end if;
 select id into own_id from members where club_id=target_club and user_id=auth.uid() and removed_at is null and (purge_after is null or purge_after>now());
 if own_id is null or not exists(select 1 from members where id=guest_id and club_id=target_club and event_guest and event_guest_of=own_id) then raise insufficient_privilege;end if;
 select * into e from events where club_id=target_club and id=target_event for update;
 if not found or e.event_kind<>'training' or e.starts_at<=now() or e.completed_at is not null then raise exception 'Guest registration closed';end if;
 if exists(select 1 from participation where event_id=target_event and member_id=guest_id and attended is not null) then raise exception 'Attendance already recorded';end if;
 delete from participation where club_id=target_club and event_id=target_event and member_id=guest_id;
end $$;
revoke all on function public.my_training_guests(uuid,uuid),public.invite_training_guest(uuid,uuid,text),public.withdraw_training_guest(uuid,uuid,uuid) from public,anon;
grant execute on function public.my_training_guests(uuid,uuid),public.invite_training_guest(uuid,uuid,text),public.withdraw_training_guest(uuid,uuid,uuid) to authenticated;

-- Event-only guests must not appear in unrelated or historic training rosters.
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
    where m.club_id=new.club_id and (not m.event_guest or p.member_id is not null) and (m.removed_at is null or m.removed_at>new.starts_at or p.attended is not null or (new.roster_only and p.member_id is not null)) and (m.purge_after is null or m.purge_after>now()) and (not new.roster_only or p.member_id is not null) and p.attended is null
   ) then raise exception 'Potvrďte docházku všech evidovaných účastníků.';end if;
  end if;
  new.completed_at:=now();new.completed_by:=auth.uid();
 end if;
 if new.completed_at is null then new.completed_by:=null;end if;
 return new;
end $$;
create or replace function public.member_event_roster(target_club uuid,target_event uuid)
returns table(member_id uuid,name text,response text,seat_status text,is_self boolean)
language plpgsql stable security definer set search_path=public as $$
declare own_id uuid;e public.events;
begin
 if not public.has_club_role(target_club,array['owner','coach','member']) then raise insufficient_privilege;end if;
 select m.id into own_id from public.members m where m.club_id=target_club and m.user_id=auth.uid() and m.removed_at is null and (m.purge_after is null or m.purge_after>now());
 if own_id is null then raise insufficient_privilege;end if;
 select * into e from public.events where id=target_event and club_id=target_club;
 if not found then raise insufficient_privilege;end if;
 if e.roster_only and not exists(select 1 from public.participation p where p.event_id=e.id and p.member_id=own_id) then raise insufficient_privilege;end if;
 return query select m.id,m.name||case when m.event_guest then ' · host' else '' end,p.response,p.seat_status,m.id=own_id
 from public.members m left join public.participation p on p.event_id=e.id and p.member_id=m.id
 where m.club_id=target_club and (not m.event_guest or p.member_id is not null) and m.removed_at is null and (m.purge_after is null or m.purge_after>now())
 and ((e.event_kind='training' and not e.roster_only) or p.member_id is not null or m.id=own_id)
 order by (m.id=own_id) desc,m.name,m.id;
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
 if e.roster_only and not exists(select 1 from public.participation where event_id=e.id and member_id=m.id) then raise exception 'Not on this event roster';end if;
 if answer<>'yes' and e.event_kind='training' then delete from public.participation p using public.members g where p.event_id=e.id and p.member_id=g.id and p.club_id=target_club and g.event_guest and g.event_guest_of=m.id and p.attended is null;end if;
 insert into public.participation(club_id,event_id,member_id,response) values(target_club,e.id,m.id,answer) on conflict(event_id,member_id) do update set response=excluded.response;
 select * into result from public.participation where event_id=e.id and member_id=m.id;
 return result;
end $$;
create or replace function public.mark_training_present(target_club uuid,target_event uuid,entrants uuid[]) returns integer language plpgsql security definer set search_path=public as $$
declare e public.events; m uuid; n integer:=0; changed integer;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select * into e from public.events where id=target_event and club_id=target_club for update;
 if not found or e.event_kind<>'training' or e.status<>'scheduled' or e.starts_at>now() then raise exception 'Vyberte zahájený trénink.';end if;
 if entrants is null or cardinality(entrants)<1 or cardinality(entrants)>500 then raise exception 'Neplatný počet členů.';end if;
 for m in select distinct unnest(entrants) loop
  if not exists(select 1 from public.members x where x.id=m and x.club_id=target_club and (not x.event_guest or exists(select 1 from participation invited where invited.event_id=e.id and invited.member_id=x.id)) and ((not e.roster_only and (x.removed_at is null or x.removed_at>e.starts_at)) or exists(select 1 from public.participation p where p.event_id=e.id and p.member_id=m))) then raise exception 'Člen není v soupisce.';end if;
  insert into public.participation(club_id,event_id,member_id,attended,confirmed_by) values(target_club,target_event,m,true,auth.uid()) on conflict(event_id,member_id) do update set attended=true,attendance_excused=false,confirmed_by=auth.uid() where participation.attended is null;
  get diagnostics changed=row_count;n:=n+changed;
 end loop;
 return n;
end $$;
create or replace function public.apply_training_game(target_club uuid,target_event uuid,target_game uuid,label text,kind text,details text,entrants uuid[],expected_revision integer default null) returns void language plpgsql security definer set search_path=public as $$
declare e public.events;g public.training_games;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select * into e from public.events where id=target_event and club_id=target_club and event_kind='training' and status='scheduled' for update;
 if not found then raise exception 'Minihry patří jen do plánovaného tréninku.';end if;
 if label is null or length(trim(label)) not between 1 and 80 or kind is null or kind not in ('time','repetitions','distance','points') or details is null or length(details)>2000 or entrants is null or cardinality(entrants) not between 1 and 100 or cardinality(entrants)<>(select count(distinct m) from unnest(entrants) m) then raise exception 'Zkontrolujte název, typ a 1–100 různých účastníků.';end if;
 if exists(select 1 from unnest(entrants) as selected(member_id) where not exists(select 1 from public.members m where m.id=selected.member_id and m.club_id=target_club and (not m.event_guest or exists(select 1 from participation invited where invited.event_id=e.id and invited.member_id=m.id)) and ((not e.roster_only and (m.removed_at is null or m.removed_at>e.starts_at)) or exists(select 1 from public.participation p where p.event_id=e.id and p.member_id=m.id)))) then raise exception 'Účastník není v soupisce tréninku.';end if;
 select * into g from public.training_games where id=target_game and club_id=target_club and event_id=e.id for update;
 if found then
  if expected_revision is null or g.revision<>expected_revision then raise exception 'Minihra se mezitím změnila. Obnovte přehled.';end if;
  if g.scoring<>kind then raise exception 'Typ uložené minihry nelze měnit. Vytvořte novou minihru.';end if;
  update public.training_games set name=trim(label),notes=trim(details),revision=revision+1 where id=g.id;
  delete from public.training_game_entries where game_id=g.id and not(member_id=any(entrants));
 else
  if expected_revision is not null then raise exception 'Minihra už neexistuje. Obnovte přehled.';end if;
  if (select count(*) from public.training_games where event_id=e.id)>=20 then raise exception 'Nejvýše 20 miniher v jednom tréninku.';end if;
  insert into public.training_games(id,club_id,event_id,name,scoring,notes) values(target_game,target_club,e.id,trim(label),kind,trim(details));
 end if;
 -- Whole-club trainings may not have RSVP rows yet. Add only missing roster rows.
 insert into public.participation(club_id,event_id,member_id) select target_club,e.id,m from unnest(entrants) m on conflict(event_id,member_id) do nothing;
 insert into public.training_game_entries(club_id,event_id,game_id,member_id) select target_club,e.id,target_game,m from unnest(entrants) m on conflict(game_id,member_id) do nothing;
end $$;
create function public.withdraw_sponsored_guests_on_archive() returns trigger language plpgsql security definer set search_path=public as $$begin
 if old.removed_at is null and new.removed_at is not null and not new.event_guest then
  delete from participation p using members g,events e where p.club_id=new.club_id and p.member_id=g.id and g.event_guest and g.event_guest_of=new.id and e.id=p.event_id and e.club_id=p.club_id and e.starts_at>now() and e.completed_at is null and p.attended is null;
 end if;return new;
end $$;
revoke all on function public.withdraw_sponsored_guests_on_archive() from public,anon,authenticated;
create trigger sponsored_guests_archive after update of removed_at on public.members for each row execute function public.withdraw_sponsored_guests_on_archive();
commit;
