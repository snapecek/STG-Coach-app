begin;
-- Never select a different owner silently: inconsistent existing ownership must
-- be resolved explicitly before this migration can be applied.
create unique index one_owner_per_club on public.club_roles(club_id) where role='owner';
alter table public.clubs add column archived_at timestamptz,add column archive_expires_at timestamptz;
create table public.club_archives(
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),owner_id uuid not null references auth.users(id),
 club_name text not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '3 months',
 snapshot jsonb not null,restored_at timestamptz
);
alter table public.club_archives enable row level security;
revoke all on public.club_archives from public,anon,authenticated;
create index club_archive_owner on public.club_archives(owner_id,created_at desc);
create or replace function public.has_club_role(target uuid,roles text[]) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from club_roles r join clubs c on c.id=r.club_id where r.club_id=target and r.user_id=auth.uid() and r.role=any(roles) and c.archived_at is null);
$$;
create function public.guard_club_owner() returns trigger language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is not null and old.role='owner' and (tg_op='DELETE' or new.role<>'owner' or new.user_id<>old.user_id or new.club_id<>old.club_id) then raise exception 'Owner cannot be removed';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger protect_club_owner before update or delete on public.club_roles for each row execute function public.guard_club_owner();
-- Every normal row mutation shares the archive lock. A request authorized before
-- archival cannot finish writing after its snapshot has been taken.
create function public.guard_active_club_data() returns trigger language plpgsql security definer set search_path=public as $$declare target uuid;begin
 target:=case when tg_op='DELETE' then old.club_id else new.club_id end;
 if tg_op='UPDATE' and old.club_id is distinct from new.club_id then
  perform pg_advisory_xact_lock(hashtextextended('club-state:'||old.club_id::text,0));
  if auth.uid() is not null and exists(select 1 from clubs c where c.id=old.club_id and c.archived_at is not null) then raise exception 'Club archived';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('club-state:'||target::text,0));
 if auth.uid() is not null and exists(select 1 from clubs c where c.id=target and c.archived_at is not null) then raise exception 'Club archived';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
do $$declare t record;begin
 for t in select table_name from information_schema.columns where table_schema='public' and column_name='club_id' and table_name<>'club_archives' loop
  execute format('create trigger club_archive_write_guard before insert or update or delete on public.%I for each row execute function public.guard_active_club_data()',t.table_name);
 end loop;
end $$;
create function public.guard_archived_club_storage() returns trigger language plpgsql security definer set search_path=public as $$declare object_name text;bucket text;target uuid;begin
 object_name:=case when tg_op='DELETE' then old.name else new.name end;bucket:=case when tg_op='DELETE' then old.bucket_id else new.bucket_id end;
 if tg_op='UPDATE' and old.bucket_id in ('club-logos','club-photos','app-feedback') and split_part(old.name,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  target:=split_part(old.name,'/',1)::uuid;perform pg_advisory_xact_lock(hashtextextended('club-state:'||target::text,0));
  if auth.uid() is not null and exists(select 1 from clubs c where c.id=target and c.archived_at is not null) then raise exception 'Club archived';end if;
 end if;
 if bucket in ('club-logos','club-photos','app-feedback') and split_part(object_name,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  target:=split_part(object_name,'/',1)::uuid;perform pg_advisory_xact_lock(hashtextextended('club-state:'||target::text,0));
  if auth.uid() is not null and exists(select 1 from clubs c where c.id=target and c.archived_at is not null) then raise exception 'Club archived';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger club_archive_storage_guard before insert or update or delete on storage.objects for each row execute function public.guard_archived_club_storage();
revoke all on function public.guard_archived_club_storage() from public,anon,authenticated;
revoke update on public.clubs from authenticated;
grant update(name) on public.clubs to authenticated;
create function public.guard_archived_club_metadata() returns trigger language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is not null and old.archived_at is not null and new.archived_at is not distinct from old.archived_at then raise exception 'Club archived';end if;
 return new;
end $$;
create trigger archived_club_metadata_guard before update on public.clubs for each row execute function public.guard_archived_club_metadata();
revoke all on function public.guard_archived_club_metadata() from public,anon,authenticated;
-- Existing clients and direct requests must obey the same owner-only settings.
create or replace function public.set_club_logo(target_club uuid,new_path text default null) returns text language plpgsql security definer set search_path=public as $$declare previous text;begin
 if not public.has_club_role(target_club,array['owner']) then raise insufficient_privilege;end if;
 if new_path is not null and (public.club_logo_club(new_path) is distinct from target_club or not exists(select 1 from storage.objects o where o.bucket_id='club-logos' and o.name=new_path)) then raise exception 'Invalid logo';end if;
 select c.logo_path into previous from clubs c where c.id=target_club for update;
 update clubs set logo_path=new_path where id=target_club;return previous;
end $$;
drop policy club_logo_upload on storage.objects;
drop policy club_logo_delete on storage.objects;
create policy club_logo_upload on storage.objects for insert to authenticated with check(bucket_id='club-logos' and public.has_club_role(public.club_logo_club(name),array['owner']));
create policy club_logo_delete on storage.objects for delete to authenticated using(bucket_id='club-logos' and public.has_club_role(public.club_logo_club(name),array['owner']) and not exists(select 1 from public.clubs c where c.logo_path=storage.objects.name));
create or replace function public.add_club_coach(target_club uuid,target_member uuid) returns void language plpgsql security definer set search_path=public as $$declare member_user uuid;begin
 if not public.has_club_role(target_club,array['owner']) then raise insufficient_privilege;end if;
 select m.user_id into member_user from members m where m.club_id=target_club and m.id=target_member and m.user_id is not null and m.removed_at is null and (m.purge_after is null or m.purge_after>now()) for update;
 if member_user is null or not exists(select 1 from club_roles r where r.club_id=target_club and r.user_id=member_user and r.role in ('member','coach')) then raise exception 'Member account unavailable';end if;
 update club_roles set role='coach' where club_id=target_club and user_id=member_user and role='member';
end $$;
create or replace function public.create_managed_club(club_name text) returns table(id uuid,name text) language plpgsql security definer set search_path=public as $$declare created_id uuid;begin
 if auth.uid() is null or not exists(select 1 from club_roles r join clubs c on c.id=r.club_id where r.user_id=auth.uid() and r.role='owner' and c.archived_at is null) then raise insufficient_privilege;end if;
 if club_name is null or length(trim(club_name)) not between 1 and 100 or club_name !~ '[^[:space:]]' then raise exception 'Invalid club name';end if;
 insert into clubs(name) values(trim(club_name)) returning clubs.id into created_id;
 insert into club_roles(club_id,user_id,role) values(created_id,auth.uid(),'owner');
 return query select c.id,c.name from clubs c where c.id=created_id;
end $$;
create function public.remove_club_coach(target_club uuid,target_user uuid) returns void language plpgsql security definer set search_path=public as $$begin
 if not public.has_club_role(target_club,array['owner']) then raise insufficient_privilege;end if;
 if not exists(select 1 from members m where m.club_id=target_club and m.user_id=target_user and m.removed_at is null and (m.purge_after is null or m.purge_after>now())) then
  delete from club_roles where club_id=target_club and user_id=target_user and role='coach';
 else update club_roles set role='member' where club_id=target_club and user_id=target_user and role='coach';end if;
end $$;
create function public.rename_club(target_club uuid,club_name text) returns void language plpgsql security definer set search_path=public as $$begin
 if not public.has_club_role(target_club,array['owner']) then raise insufficient_privilege;end if;
 if club_name is null or length(trim(club_name)) not between 1 and 100 or club_name !~ '[^[:space:]]' then raise exception 'Invalid club name';end if;
 update clubs set name=trim(club_name) where id=target_club;
end $$;
-- JSON snapshot includes every club-scoped application table and mention rows.
-- Authentication credentials are never exported. The storage manifest lists files
-- which remain protected in Storage throughout the recovery window.
create function public.build_club_snapshot(target_club uuid) returns jsonb language plpgsql security definer set search_path=public as $$declare result jsonb;t record;rows jsonb;begin
 result:=jsonb_build_object('format','trenomi-club-backup-v1','created_at',now(),'club',(select to_jsonb(c) from clubs c where c.id=target_club),'tables','{}'::jsonb);
 for t in select table_name from information_schema.columns where table_schema='public' and column_name='club_id' and table_name<>'club_archives' order by table_name loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from public.%I t where t.club_id=$1',t.table_name) into rows using target_club;
  result:=jsonb_set(result,array['tables',t.table_name],rows);
 end loop;
 result:=jsonb_set(result,'{tables,chat_mentions}',coalesce((select jsonb_agg(to_jsonb(n)) from chat_mentions n join chat_messages m on m.id=n.message_id where m.club_id=target_club),'[]'::jsonb));
 result:=result||jsonb_build_object('files',coalesce((select jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'path',o.name)) from storage.objects o where o.bucket_id in ('club-logos','club-photos','app-feedback') and split_part(o.name,'/',1)=target_club::text),'[]'::jsonb));
 return result;
end $$;
revoke all on function public.build_club_snapshot(uuid) from public,anon,authenticated;
create function public.export_club_backup(target_club uuid) returns jsonb language plpgsql security definer set search_path=public as $$begin
 if not public.has_club_role(target_club,array['owner']) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended('club-state:'||target_club::text,0));
 return public.build_club_snapshot(target_club);
end $$;
create function public.archive_club(target_club uuid,confirmation_name text) returns uuid language plpgsql security definer set search_path=public as $$declare club_row clubs;backup_id uuid;begin
 perform pg_advisory_xact_lock(hashtextextended('club-state:'||target_club::text,0));
 if not public.has_club_role(target_club,array['owner']) then raise insufficient_privilege;end if;
 select * into club_row from clubs where id=target_club for update;
 if confirmation_name is distinct from club_row.name then raise exception 'Club name confirmation mismatch';end if;
 insert into club_archives(club_id,owner_id,club_name,snapshot) values(target_club,auth.uid(),club_row.name,public.build_club_snapshot(target_club)) returning id into backup_id;
 update clubs set archived_at=now(),archive_expires_at=now()+interval '3 months' where id=target_club;
 return backup_id;
end $$;
create function public.list_archived_clubs() returns table(archive_id uuid,club_id uuid,name text,archived_at timestamptz,expires_at timestamptz) language sql stable security definer set search_path=public as $$
 select a.id,a.club_id,a.club_name,a.created_at,a.expires_at from club_archives a join clubs c on c.id=a.club_id where a.owner_id=auth.uid() and a.restored_at is null and c.archived_at is not null and a.expires_at>now() order by a.created_at desc;
$$;
create function public.restore_archived_club(target_archive uuid) returns table(id uuid,name text) language plpgsql security definer set search_path=public as $$declare a club_archives;begin
 select * into a from club_archives where club_archives.id=target_archive and owner_id=auth.uid() and expires_at>now() and restored_at is null;
 if not found then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended('club-state:'||a.club_id::text,0));
 update clubs set archived_at=null,archive_expires_at=null where clubs.id=a.club_id and archived_at is not null;
 update club_archives set restored_at=now() where club_archives.id=target_archive;
 return query select c.id,c.name from clubs c where c.id=a.club_id;
end $$;
-- Existing member-retention cron must not remove rows from a frozen club.
create or replace function public.purge_expired_members() returns integer language plpgsql security definer set search_path=public as $$declare removed integer;begin
 delete from public.members m where m.purge_after<=now()+interval '1 day' and exists(select 1 from clubs c where c.id=m.club_id and c.archived_at is null);
 get diagnostics removed=row_count;return removed;
end $$;
-- No app account can destroy or alter an archived snapshot, or hard-delete a club.
revoke delete on public.clubs from authenticated;
revoke all on function public.guard_club_owner(),public.guard_active_club_data() from public,anon,authenticated;
revoke all on function public.remove_club_coach(uuid,uuid),public.rename_club(uuid,text),public.export_club_backup(uuid),public.archive_club(uuid,text),public.list_archived_clubs(),public.restore_archived_club(uuid) from public,anon;
grant execute on function public.remove_club_coach(uuid,uuid),public.rename_club(uuid,text),public.export_club_backup(uuid),public.archive_club(uuid,text),public.list_archived_clubs(),public.restore_archived_club(uuid) to authenticated;
commit;
