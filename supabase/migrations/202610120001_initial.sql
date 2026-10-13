-- First-stage tenant schema. No public member or photo access.
create table public.clubs(id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table public.club_roles(club_id uuid not null references public.clubs on delete cascade, user_id uuid not null references auth.users on delete cascade, role text not null check(role in ('owner','coach','member')), primary key(club_id,user_id));
create function public.has_club_role(target uuid, roles text[]) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.club_roles where club_id=target and user_id=auth.uid() and role=any(roles)); $$;
revoke all on function public.has_club_role(uuid,text[]) from public;
grant execute on function public.has_club_role(uuid,text[]) to authenticated;
create table public.members(id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs on delete cascade, user_id uuid references auth.users on delete set null, name text not null, kind text not null check(kind in ('member','guest')), unique(club_id,id));
create table public.templates(id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs on delete cascade, name text not null, type text not null, place text not null, minutes integer not null check(minutes between 5 and 480), plan text not null default '', unique(club_id,id));
create table public.events(id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs on delete cascade, template_id uuid, name text not null, starts_at timestamptz not null, place text not null, type text not null, plan text not null default '', unique(club_id,id), foreign key(club_id,template_id) references public.templates(club_id,id));
create table public.participation(club_id uuid not null references public.clubs on delete cascade, event_id uuid not null, member_id uuid not null, response text check(response in ('yes','no','maybe')), attended boolean, confirmed_by uuid references auth.users, primary key(event_id,member_id), foreign key(club_id,event_id) references public.events(club_id,id) on delete cascade, foreign key(club_id,member_id) references public.members(club_id,id) on delete cascade);
alter table public.clubs enable row level security;
alter table public.club_roles enable row level security;
alter table public.members enable row level security;
alter table public.templates enable row level security;
alter table public.events enable row level security;
alter table public.participation enable row level security;
create policy club_read on public.clubs for select to authenticated using(public.has_club_role(id,array['owner','coach','member']));
create policy club_update on public.clubs for update to authenticated using(public.has_club_role(id,array['owner'])) with check(public.has_club_role(id,array['owner']));
create policy roles_read on public.club_roles for select to authenticated using(public.has_club_role(club_id,array['owner','coach','member']));
create policy roles_manage on public.club_roles for all to authenticated using(public.has_club_role(club_id,array['owner'])) with check(public.has_club_role(club_id,array['owner']));
-- Member records are visible to staff only in stage 1.
create policy members_staff on public.members for all to authenticated using(public.has_club_role(club_id,array['owner','coach'])) with check(public.has_club_role(club_id,array['owner','coach']));
create policy templates_read on public.templates for select to authenticated using(public.has_club_role(club_id,array['owner','coach','member']));
create policy templates_write on public.templates for all to authenticated using(public.has_club_role(club_id,array['owner','coach'])) with check(public.has_club_role(club_id,array['owner','coach']));
create policy events_read on public.events for select to authenticated using(public.has_club_role(club_id,array['owner','coach','member']));
create policy events_write on public.events for all to authenticated using(public.has_club_role(club_id,array['owner','coach'])) with check(public.has_club_role(club_id,array['owner','coach']));
create policy participation_staff on public.participation for all to authenticated using(public.has_club_role(club_id,array['owner','coach'])) with check(public.has_club_role(club_id,array['owner','coach']));
revoke all on public.clubs,public.club_roles,public.members,public.templates,public.events,public.participation from anon;
grant select,insert,update,delete on public.clubs,public.club_roles,public.members,public.templates,public.events,public.participation to authenticated;
insert into storage.buckets(id,name,public) values('club-photos','club-photos',false) on conflict(id) do nothing;
-- Photo path: <club uuid>/<random filename>. Only staff may access.
create policy photo_staff on storage.objects for all to authenticated using(bucket_id='club-photos' and public.has_club_role((storage.foldername(name))[1]::uuid,array['owner','coach'])) with check(bucket_id='club-photos' and public.has_club_role((storage.foldername(name))[1]::uuid,array['owner','coach']));
