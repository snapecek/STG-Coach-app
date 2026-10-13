-- Run once after 202610120001_initial.sql. Existing data is preserved.
begin;
alter table public.members add column removed_at timestamptz, add column purge_after timestamptz;
alter table public.events add column duration_minutes integer not null default 60 check(duration_minutes between 5 and 480), add column event_kind text not null default 'training' check(event_kind in ('training','race')), add column status text not null default 'scheduled' check(status in ('scheduled','cancelled')), add column actual_notes text not null default '', add column completed_at timestamptz, add column completed_by uuid references auth.users;
alter table public.events drop constraint events_club_id_template_id_fkey;
alter table public.events add constraint events_club_id_template_id_fkey foreign key(club_id,template_id) references public.templates(club_id,id) on delete set null (template_id);
create function public.member_retention_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if new.removed_at is null then new.purge_after:=null;
 elsif tg_op='UPDATE' and old.removed_at is not null then
  new.removed_at:=old.removed_at;new.purge_after:=old.purge_after;
 else new.removed_at:=now();new.purge_after:=now()+interval '3 years';end if;
 if tg_op='UPDATE' and old.purge_after is not null and old.purge_after<=now() then raise exception 'Retention expired';end if;
 return new;
end $$;
create trigger members_retention before insert or update on public.members for each row execute function public.member_retention_guard();
drop policy members_staff on public.members;
create policy members_staff on public.members for all to authenticated using(public.has_club_role(club_id,array['owner','coach']) and (purge_after is null or purge_after>now())) with check(public.has_club_role(club_id,array['owner','coach']) and (purge_after is null or purge_after>now()));
-- Attendance of expired members is not readable pending physical cleanup.
drop policy participation_staff on public.participation;
create policy participation_staff on public.participation for all to authenticated using(public.has_club_role(club_id,array['owner','coach']) and exists(select 1 from public.members m where m.id=member_id and m.club_id=participation.club_id)) with check(public.has_club_role(club_id,array['owner','coach']) and exists(select 1 from public.members m where m.id=member_id and m.club_id=participation.club_id));
create function public.archive_club_member(target_club uuid,target_member uuid,restore boolean default false) returns public.members language plpgsql security definer set search_path=public as $$
declare m public.members;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select * into m from public.members where id=target_member and club_id=target_club for update;
 if not found or (m.purge_after is not null and m.purge_after<=now()) then raise exception 'Member unavailable';end if;
 if restore then
  update public.members set removed_at=null where id=m.id returning * into m;
  if m.user_id is not null then insert into public.club_roles(club_id,user_id,role) values(m.club_id,m.user_id,'member') on conflict do nothing;end if;
 else
  update public.members set removed_at=coalesce(removed_at,now()) where id=m.id returning * into m;
  if m.user_id is not null then delete from public.club_roles where club_id=m.club_id and user_id=m.user_id and role='member';end if;
 end if;
 return m;
end $$;
revoke all on function public.archive_club_member(uuid,uuid,boolean) from public,anon;
grant execute on function public.archive_club_member(uuid,uuid,boolean) to authenticated;
create function public.event_completion_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' and (new.starts_at,new.duration_minutes,new.name,new.place,new.type,new.plan,new.actual_notes,new.status,new.event_kind) is distinct from (old.starts_at,old.duration_minutes,old.name,old.place,old.type,old.plan,old.actual_notes,old.status,old.event_kind) then
  new.completed_at:=null;new.completed_by:=null;
 end if;
 if new.status='cancelled' then new.completed_at:=null;new.completed_by:=null;end if;
 if new.completed_at is not null and (tg_op='INSERT' or old.completed_at is distinct from new.completed_at) then
  if new.starts_at+make_interval(mins=>new.duration_minutes)>now() or length(trim(new.actual_notes))=0 then raise exception 'Doplňte skutečný průběh až po skončení události.';end if;
  if not exists(select 1 from public.participation where event_id=new.id and attended is not null) or exists(
   select 1 from public.members m left join public.participation p on p.member_id=m.id and p.event_id=new.id
   where m.club_id=new.club_id and (m.removed_at is null or m.removed_at>new.starts_at or p.member_id is not null) and (m.purge_after is null or m.purge_after>now()) and p.attended is null
  ) then raise exception 'Potvrďte docházku všech evidovaných účastníků.';end if;
  new.completed_at:=now();new.completed_by:=auth.uid();
 end if;
 if new.completed_at is null then new.completed_by:=null;end if;
 return new;
end $$;
create trigger events_completion before insert or update on public.events for each row execute function public.event_completion_guard();
create function public.invalidate_event_review() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='DELETE' and not exists(select 1 from public.members where id=old.member_id) then return null;end if;
 if tg_op='DELETE' then update public.events set completed_at=null where id=old.event_id and club_id=old.club_id;
 else update public.events set completed_at=null where id=new.event_id and club_id=new.club_id;end if;
 return null;
end $$;
create trigger participation_review after insert or update or delete on public.participation for each row execute function public.invalidate_event_review();
create function public.purge_expired_members() returns integer language plpgsql security definer set search_path=public as $$
declare removed integer;
begin
 -- Daily cleanup one day before the maximum deadline; expired rows are also hidden by RLS.
 delete from public.members where purge_after<=now()+interval '1 day';
 get diagnostics removed=row_count;return removed;
end $$;
revoke all on function public.purge_expired_members() from public,anon,authenticated;
-- Supabase supports pg_cron; local PostgreSQL test installs need not have it.
do $$begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  execute 'create extension if not exists pg_cron';
  perform cron.schedule('stg-member-retention','15 3 * * *','select public.purge_expired_members();');
 else raise notice 'pg_cron unavailable: configure a daily server-side call to purge_expired_members before production';end if;
end $$;
commit;
