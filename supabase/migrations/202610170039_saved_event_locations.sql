-- Reusable club meeting points and map snapshots in training/race templates.
begin;
alter table public.templates add column event_location jsonb check(public.valid_event_location(event_location));
alter table public.club_presets add constraint preset_event_location_valid check(
 not(settings ? 'event_location') or
 (kind='race' and (settings->'event_location'='null'::jsonb or public.valid_event_location(settings->'event_location')))
);
create table public.club_locations(
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.clubs on delete cascade,
 name text not null check(length(trim(name)) between 1 and 200 and name ~ '[^[:space:]]'),
 event_location jsonb not null check(public.valid_event_location(event_location)),
 created_at timestamptz not null default now()
);
create unique index club_location_name on public.club_locations(club_id,lower(trim(name)));
alter table public.club_locations enable row level security;
revoke all on public.club_locations from public,anon;
grant select,insert,update,delete on public.club_locations to authenticated;
create policy locations_staff on public.club_locations for all to authenticated
 using(public.has_club_role(club_id,array['owner','coach']))
 with check(public.has_club_role(club_id,array['owner','coach']));
-- Participate in the same archive locking and automatic backup as other club data.
create trigger club_archive_write_guard before insert or update or delete on public.club_locations
 for each row execute function public.guard_active_club_data();
commit;
