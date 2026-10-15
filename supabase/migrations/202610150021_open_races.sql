-- Races are discoverable by club members before they register with the organizer.
-- Existing races are included; private training rosters retain their access rules.
begin;
create or replace function public.create_club_race(target_club uuid,race jsonb,entrants uuid[]) returns public.events language plpgsql set search_path=public as $$
declare created public.events;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 if entrants is null or cardinality(entrants)>500 or cardinality(entrants)<>(select count(distinct id) from unnest(entrants) id) then raise exception 'Choose up to 500 distinct entrants';end if;
 if cardinality(entrants)<>(select count(*) from public.members where club_id=target_club and id=any(entrants) and removed_at is null and (purge_after is null or purge_after>now())) then raise exception 'Entrants must be active members of this club';end if;
 if length(trim(coalesce(race->>'name',''))) not between 1 and 80 or length(trim(coalesce(race->>'place',''))) not between 1 and 200 or length(trim(coalesce(race->>'type',''))) not between 1 and 40 or length(coalesce(race->>'plan',''))>5000 then raise exception 'Invalid race details';end if;
 insert into public.events(id,club_id,name,place,type,plan,starts_at,duration_minutes,event_kind,race_distance_km,race_registration_url)
 values((race->>'id')::uuid,target_club,trim(race->>'name'),trim(race->>'place'),trim(race->>'type'),coalesce(race->>'plan',''),(race->>'starts_at')::timestamptz,(race->>'duration_minutes')::integer,'race',(race->>'race_distance_km')::numeric,coalesce(race->>'race_registration_url','')) returning * into created;
 insert into public.participation(club_id,event_id,member_id) select target_club,created.id,id from unnest(entrants) id;
 return created;
end $$;

create or replace function public.can_read_club_event(target_club uuid,target_event uuid) returns boolean
 language sql stable security definer set search_path=public as $$
 select public.has_club_role(target_club,array['owner','coach','member']) and exists(
 select 1 from public.events e where e.id=target_event and e.club_id=target_club and (
 not e.roster_only or exists(
 select 1 from public.participation p join public.members m on m.id=p.member_id and m.club_id=p.club_id
 where p.event_id=e.id and m.user_id=auth.uid() and m.removed_at is null and (m.purge_after is null or m.purge_after>now())
 )));
$$;

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
 insert into public.participation(club_id,event_id,member_id,response) values(target_club,e.id,m.id,answer) on conflict(event_id,member_id) do update set response=excluded.response;
 select * into result from public.participation where event_id=e.id and member_id=m.id;
 return result;
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
 return query select m.id,m.name,p.response,p.seat_status,m.id=own_id
 from public.members m left join public.participation p on p.event_id=e.id and p.member_id=m.id
 where m.club_id=target_club and m.removed_at is null and (m.purge_after is null or m.purge_after>now())
 and ((e.event_kind='training' and not e.roster_only) or p.member_id is not null or m.id=own_id)
 order by (m.id=own_id) desc,m.name,m.id;
end $$;
commit;
