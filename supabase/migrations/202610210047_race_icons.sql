-- Enable persisted icon selection for races using the existing icon column.
begin;
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

create or replace function public.create_club_race(target_club uuid,race jsonb,entrants uuid[]) returns public.events language plpgsql set search_path=public as $$
declare created public.events;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 if entrants is null or cardinality(entrants)>500 or cardinality(entrants)<>(select count(distinct id) from unnest(entrants) id) then raise exception 'Choose up to 500 distinct entrants';end if;
 if cardinality(entrants)<>(select count(*) from public.members where club_id=target_club and id=any(entrants) and removed_at is null and (purge_after is null or purge_after>now())) then raise exception 'Entrants must be active members of this club';end if;
 if length(trim(coalesce(race->>'name',''))) not between 1 and 80 or length(trim(coalesce(race->>'place',''))) not between 1 and 200 or length(trim(coalesce(race->>'type',''))) not between 1 and 40 or length(coalesce(race->>'plan',''))>5000 then raise exception 'Invalid race details';end if;
 insert into public.events(id,club_id,name,place,type,plan,starts_at,duration_minutes,event_kind,race_distance_km,race_registration_url,event_location,training_icon)
 values((race->>'id')::uuid,target_club,trim(race->>'name'),trim(race->>'place'),trim(race->>'type'),coalesce(race->>'plan',''),(race->>'starts_at')::timestamptz,(race->>'duration_minutes')::integer,'race',(race->>'race_distance_km')::numeric,coalesce(race->>'race_registration_url',''),nullif(race->'event_location','null'::jsonb),nullif(race->>'training_icon','')) returning * into created;
 insert into public.participation(club_id,event_id,member_id) select target_club,created.id,id from unnest(entrants) id;
 return created;
end $$;

create function public.race_icons_ready() returns boolean language sql stable security invoker set search_path=public,pg_temp as $$select auth.uid() is not null$$;
revoke all on function public.race_icons_ready() from public,anon;
grant execute on function public.race_icons_ready() to authenticated;
commit;
