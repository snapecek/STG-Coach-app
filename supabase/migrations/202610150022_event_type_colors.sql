-- Shared calendar colors per club, event kind and discipline. No event history is rewritten.
begin;
create table public.event_type_colors(
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.clubs(id) on delete cascade,
 event_kind text not null check(event_kind in ('training','race')),
 type_key text not null check(length(type_key) between 1 and 40 and type_key=lower(btrim(type_key))),
 color text not null check(color in ('#78c3ba','#ff925c','#70b5ff','#92d68b','#bba7ed','#f3a0cb','#f6d17c','#f2979b')),
 unique(club_id,event_kind,type_key)
);
alter table public.event_type_colors enable row level security;
create policy event_type_colors_read on public.event_type_colors for select to authenticated using(public.has_club_role(club_id,array['owner','coach','member']));
create policy event_type_colors_insert on public.event_type_colors for insert to authenticated with check(public.has_club_role(club_id,array['owner','coach']));
create policy event_type_colors_update on public.event_type_colors for update to authenticated using(public.has_club_role(club_id,array['owner','coach'])) with check(public.has_club_role(club_id,array['owner','coach']));
create policy event_type_colors_delete on public.event_type_colors for delete to authenticated using(public.has_club_role(club_id,array['owner','coach']));
revoke all on public.event_type_colors from public,anon;
grant select,insert,update,delete on public.event_type_colors to authenticated;
commit;
