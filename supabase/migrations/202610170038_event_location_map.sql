-- Optional geographic meeting point and approach arrows; existing events remain unchanged.
begin;
create function public.valid_event_map_point(v jsonb) returns boolean language plpgsql immutable set search_path=public as $$
begin
 if v is null or jsonb_typeof(v)<>'object' or not(v ?& array['lat','lng']) or v-array['lat','lng']<>'{}'::jsonb then return false;end if;
 if jsonb_typeof(v->'lat')<>'number' or jsonb_typeof(v->'lng')<>'number' then return false;end if;
 return (v->>'lat')::numeric between -85 and 85 and (v->>'lng')::numeric between -180 and 180;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end $$;
create function public.valid_event_location(v jsonb) returns boolean language plpgsql immutable set search_path=public as $$
declare a jsonb;
begin
 if v is null then return true;end if;
 if jsonb_typeof(v)<>'object' or not(v ?& array['point','arrows','note']) or v-array['point','arrows','note']<>'{}'::jsonb then return false;end if;
 if not public.valid_event_map_point(v->'point') or jsonb_typeof(v->'arrows')<>'array' or jsonb_typeof(v->'note')<>'string' then return false;end if;
 if jsonb_array_length(v->'arrows')>8 or length(v->>'note')>500 then return false;end if;
 for a in select value from jsonb_array_elements(v->'arrows') loop
  if jsonb_typeof(a)<>'object' or not(a ?& array['from','to']) or a-array['from','to']<>'{}'::jsonb then return false;end if;
  if not public.valid_event_map_point(a->'from') or not public.valid_event_map_point(a->'to') or a->'from'=a->'to' then return false;end if;
 end loop;
 return true;
end $$;
revoke all on function public.valid_event_map_point(jsonb),public.valid_event_location(jsonb) from public,anon;
grant execute on function public.valid_event_map_point(jsonb),public.valid_event_location(jsonb) to authenticated;
alter table public.events add column event_location jsonb check(public.valid_event_location(event_location));
-- Keep series and group creation atomic and retain all existing role/roster checks.
create or replace function public.create_training_series(target_club uuid,sessions jsonb) returns setof public.events language plpgsql set search_path=public as $$
declare s jsonb;e public.events;sid uuid;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 if sessions is null or jsonb_typeof(sessions)<>'array' or jsonb_array_length(sessions) not between 1 and 12 then raise exception 'Choose 1 to 12 trainings';end if;
 if jsonb_array_length(sessions)>1 then sid:=gen_random_uuid();end if;
 for s in select value from jsonb_array_elements(sessions) loop
 if s->>'name' is null or length(trim(s->>'name')) not between 1 and 80 or s->>'place' is null or length(trim(s->>'place')) not between 1 and 200 or s->>'type' is null or length(trim(s->>'type')) not between 1 and 40 or length(coalesce(s->>'plan',''))>5000 then raise exception 'Invalid training details';end if;
 insert into public.events(id,club_id,template_id,name,place,type,plan,starts_at,duration_minutes,capacity,event_kind,event_location,series_id)
 values((s->>'id')::uuid,target_club,(s->>'template_id')::uuid,trim(s->>'name'),trim(s->>'place'),trim(s->>'type'),coalesce(s->>'plan',''),(s->>'starts_at')::timestamptz,(s->>'duration_minutes')::integer,(s->>'capacity')::integer,'training',nullif(s->'event_location','null'::jsonb),sid) returning * into e;
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
 insert into public.events(id,club_id,template_id,name,place,type,plan,starts_at,duration_minutes,capacity,event_kind,event_location,source_group_id,group_name,roster_only,series_id)
 values((s->>'id')::uuid,target_club,(s->>'template_id')::uuid,trim(s->>'name'),trim(s->>'place'),trim(s->>'type'),coalesce(s->>'plan',''),(s->>'starts_at')::timestamptz,(s->>'duration_minutes')::integer,(s->>'capacity')::integer,'training',nullif(s->'event_location','null'::jsonb),g.id,g.name,true,sid) returning * into e;
 insert into public.participation(club_id,event_id,member_id) select target_club,e.id,id from unnest(entrants)id;
 return next e;
 end loop;
end $$;

create or replace function public.create_club_race(target_club uuid,race jsonb,entrants uuid[]) returns public.events language plpgsql set search_path=public as $$
declare created public.events;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 if entrants is null or cardinality(entrants)>500 or cardinality(entrants)<>(select count(distinct id) from unnest(entrants) id) then raise exception 'Choose up to 500 distinct entrants';end if;
 if cardinality(entrants)<>(select count(*) from public.members where club_id=target_club and id=any(entrants) and removed_at is null and (purge_after is null or purge_after>now())) then raise exception 'Entrants must be active members of this club';end if;
 if length(trim(coalesce(race->>'name',''))) not between 1 and 80 or length(trim(coalesce(race->>'place',''))) not between 1 and 200 or length(trim(coalesce(race->>'type',''))) not between 1 and 40 or length(coalesce(race->>'plan',''))>5000 then raise exception 'Invalid race details';end if;
 insert into public.events(id,club_id,name,place,type,plan,starts_at,duration_minutes,event_kind,race_distance_km,race_registration_url,event_location)
 values((race->>'id')::uuid,target_club,trim(race->>'name'),trim(race->>'place'),trim(race->>'type'),coalesce(race->>'plan',''),(race->>'starts_at')::timestamptz,(race->>'duration_minutes')::integer,'race',(race->>'race_distance_km')::numeric,coalesce(race->>'race_registration_url',''),nullif(race->'event_location','null'::jsonb)) returning * into created;
 insert into public.participation(club_id,event_id,member_id) select target_club,created.id,id from unnest(entrants) id;
 return created;
end $$;
commit;
