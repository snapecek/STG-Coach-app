-- Repair missing race-icon helpers and persist new race guests atomically.
-- Safe after 052 and safe to re-run; does not rewrite historical rows.
begin;
alter table public.templates drop constraint if exists templates_training_icon_check;
alter table public.templates add constraint templates_training_icon_check check(training_icon in ('running','stopwatch','swimming','dumbbell','wrestling','bench-press','cycling','tennis','football','hurdle-jump','track','martial-arts','skipping','road-cycling','rowing','rugby','water-polo','table-tennis','hiking','equestrian','ocr','trail','triathlon','run-workout','hiit','kettlebell','none'));
alter table public.events drop constraint if exists events_training_icon_check;
alter table public.events add constraint events_training_icon_check check(training_icon in ('running','stopwatch','swimming','dumbbell','wrestling','bench-press','cycling','tennis','football','hurdle-jump','track','martial-arts','skipping','road-cycling','rowing','rugby','water-polo','table-tennis','hiking','equestrian','ocr','trail','triathlon','run-workout','hiit','kettlebell','none'));
create or replace function public.snapshot_training_icon() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 -- Race icons are explicit snapshots and must never inherit training templates.
 if new.event_kind='race' then return new;end if;
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


create or replace function public.add_race_guest(target_club uuid,target_event uuid,guest_name text,guest_response text default 'yes') returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.events;g public.members;normalized text;
begin
 if auth.uid() is null or not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select * into e from public.events where club_id=target_club and id=target_event for update;
 if not found or e.event_kind<>'race' or e.status<>'scheduled' then raise exception 'Race unavailable';end if;
 if guest_response is null or guest_response not in ('yes','companion') then raise exception 'Invalid guest role';end if;
 normalized:=regexp_replace(trim(guest_name),'[[:space:]]+',' ','g');
 if normalized is null or length(normalized) not between 1 and 80 or normalized !~ '[^[:space:]]' or normalized ~ '[[:cntrl:]]' then raise exception 'Invalid guest name';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_club::text||lower(normalized),0));
 select * into g from public.members where club_id=target_club and lower(regexp_replace(trim(name),'[[:space:]]+',' ','g'))=lower(normalized) order by id limit 1 for update;
 if found then
  -- A retried successful request must not duplicate the guest or change a role.
  if g.kind='guest' and g.user_id is null and g.removed_at is null and (g.purge_after is null or g.purge_after>now()) and exists(select 1 from public.participation where event_id=target_event and member_id=g.id) then return g.id;end if;
  raise exception 'Guest already exists';
 end if;
 insert into public.members(club_id,name,kind,event_guest) values(target_club,normalized,'guest',true) returning * into g;
 insert into public.participation(club_id,event_id,member_id,response) values(target_club,target_event,g.id,guest_response);
 return g.id;
end $$;
revoke all on function public.add_race_guest(uuid,uuid,text,text) from public,anon;
grant execute on function public.add_race_guest(uuid,uuid,text,text) to authenticated;

create or replace function public.create_club_race(target_club uuid,race jsonb,entrants uuid[]) returns public.events language plpgsql set search_path=public as $$
declare created public.events;guest jsonb;guests jsonb;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 if entrants is null or cardinality(entrants)>500 or cardinality(entrants)<>(select count(distinct id) from unnest(entrants) id) then raise exception 'Choose up to 500 distinct entrants';end if;
 if cardinality(entrants)<>(select count(*) from public.members where club_id=target_club and id=any(entrants) and removed_at is null and (purge_after is null or purge_after>now())) then raise exception 'Entrants must be active members of this club';end if;
 if length(trim(coalesce(race->>'name',''))) not between 1 and 80 or length(trim(coalesce(race->>'place',''))) not between 1 and 200 or length(trim(coalesce(race->>'type',''))) not between 1 and 40 or length(coalesce(race->>'plan',''))>5000 then raise exception 'Invalid race details';end if;
 guests:=coalesce(race->'guests','[]'::jsonb);
 if jsonb_typeof(guests)<>'array' or jsonb_array_length(guests)+cardinality(entrants)>500 then raise exception 'Choose up to 500 entrants including guests';end if;
 insert into public.events(id,club_id,name,place,type,plan,starts_at,duration_minutes,event_kind,race_distance_km,race_registration_url,event_location,training_icon)
 values((race->>'id')::uuid,target_club,trim(race->>'name'),trim(race->>'place'),trim(race->>'type'),coalesce(race->>'plan',''),(race->>'starts_at')::timestamptz,(race->>'duration_minutes')::integer,'race',(race->>'race_distance_km')::numeric,coalesce(race->>'race_registration_url',''),nullif(race->'event_location','null'::jsonb),nullif(race->>'training_icon','')) returning * into created;
 insert into public.participation(club_id,event_id,member_id) select target_club,created.id,id from unnest(entrants) id;
 for guest in select value from jsonb_array_elements(guests) loop
  if jsonb_typeof(guest)<>'object' or jsonb_typeof(guest->'name') is distinct from 'string' or jsonb_typeof(guest->'role') is distinct from 'string' then raise exception 'Invalid guest details';end if;
  perform public.add_race_guest(target_club,created.id,guest->>'name',guest->>'role');
 end loop;
 return created;
end $$;

revoke all on function public.create_club_race(uuid,jsonb,uuid[]) from public,anon;
grant execute on function public.create_club_race(uuid,jsonb,uuid[]) to authenticated;
create or replace function public.race_icons_ready() returns boolean language sql stable security invoker set search_path=public,pg_temp as $$select auth.uid() is not null$$;
revoke all on function public.race_icons_ready() from public,anon;
grant execute on function public.race_icons_ready() to authenticated;
create or replace function public.special_sport_icons_ready() returns boolean language sql stable security invoker set search_path=public,pg_temp as $$select auth.uid() is not null$$;
revoke all on function public.special_sport_icons_ready() from public,anon;
grant execute on function public.special_sport_icons_ready() to authenticated;
create or replace function public.race_tools_ready() returns boolean language sql stable security invoker set search_path=public,pg_temp as $$select auth.uid() is not null$$;
revoke all on function public.race_tools_ready() from public,anon;
grant execute on function public.race_tools_ready() to authenticated;
notify pgrst,'reload schema';
commit;
