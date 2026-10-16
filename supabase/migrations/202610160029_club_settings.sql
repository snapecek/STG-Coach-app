begin;
alter table public.clubs add column logo_path text;
create function public.club_logo_club(object_path text) returns uuid language sql immutable set search_path=public as $$
 select case when object_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}\.(png|webp)$' then split_part(object_path,'/',1)::uuid else null end;
$$;
revoke all on function public.club_logo_club(text) from public,anon;
grant execute on function public.club_logo_club(text) to authenticated;
alter table public.clubs add constraint club_logo_scope check(logo_path is null or public.club_logo_club(logo_path) is not distinct from id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('club-logos','club-logos',false,2097152,array['image/png','image/webp']) on conflict(id) do nothing;
create policy club_logo_read on storage.objects for select to authenticated using(bucket_id='club-logos' and public.has_club_role(public.club_logo_club(name),array['owner','coach','member']));
create policy club_logo_upload on storage.objects for insert to authenticated with check(bucket_id='club-logos' and public.has_club_role(public.club_logo_club(name),array['owner','coach']));
create policy club_logo_delete on storage.objects for delete to authenticated using(bucket_id='club-logos' and public.has_club_role(public.club_logo_club(name),array['owner','coach']) and not exists(select 1 from public.clubs c where c.logo_path=storage.objects.name));
create function public.get_club_profile(target_club uuid) returns table(id uuid,name text,logo_path text) language plpgsql stable security definer set search_path=public as $$begin
 if not public.has_club_role(target_club,array['owner','coach','member']) then raise insufficient_privilege;end if;
 return query select c.id,c.name,c.logo_path from clubs c where c.id=target_club;
end $$;
create function public.set_club_logo(target_club uuid,new_path text default null) returns text language plpgsql security definer set search_path=public as $$declare previous text;begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 if new_path is not null and (public.club_logo_club(new_path) is distinct from target_club or not exists(select 1 from storage.objects o where o.bucket_id='club-logos' and o.name=new_path)) then raise exception 'Invalid logo';end if;
 select c.logo_path into previous from clubs c where c.id=target_club for update;
 update clubs set logo_path=new_path where id=target_club;
 return previous;
end $$;
create function public.club_settings_people(target_club uuid) returns table(user_id uuid,member_id uuid,name text,role text) language plpgsql stable security definer set search_path=public as $$begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 return query select r.user_id,m.id,coalesce(m.name,left(nullif(trim(to_jsonb(u)->'raw_user_meta_data'->>'full_name'),''),80),case when r.role='owner' then 'Správce klubu' else 'Trenér' end),r.role from club_roles r join auth.users u on u.id=r.user_id left join members m on m.club_id=r.club_id and m.user_id=r.user_id where r.club_id=target_club and (r.role in ('owner','coach') or (m.removed_at is null and m.id is not null and (m.purge_after is null or m.purge_after>now()))) order by 4,3,r.user_id;
end $$;
create function public.add_club_coach(target_club uuid,target_member uuid) returns void language plpgsql security definer set search_path=public as $$declare member_user uuid;begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select m.user_id into member_user from members m where m.club_id=target_club and m.id=target_member and m.user_id is not null and m.removed_at is null and (m.purge_after is null or m.purge_after>now()) for update;
 if member_user is null or not exists(select 1 from club_roles r where r.club_id=target_club and r.user_id=member_user and r.role in ('member','coach')) then raise exception 'Member account unavailable';end if;
 update club_roles set role='coach' where club_id=target_club and user_id=member_user and role='member';
end $$;
create function public.create_managed_club(club_name text) returns table(id uuid,name text) language plpgsql security definer set search_path=public as $$declare created_id uuid;begin
 if auth.uid() is null or not exists(select 1 from club_roles r where r.user_id=auth.uid() and r.role in ('owner','coach')) then raise insufficient_privilege;end if;
 if club_name is null or length(trim(club_name)) not between 1 and 100 or club_name !~ '[^[:space:]]' then raise exception 'Invalid club name';end if;
 insert into clubs(name) values(trim(club_name)) returning clubs.id into created_id;
 insert into club_roles(club_id,user_id,role) values(created_id,auth.uid(),'owner');
 return query select c.id,c.name from clubs c where c.id=created_id;
end $$;
revoke all on function public.get_club_profile(uuid),public.set_club_logo(uuid,text),public.club_settings_people(uuid),public.add_club_coach(uuid,uuid),public.create_managed_club(text) from public,anon;
grant execute on function public.get_club_profile(uuid),public.set_club_logo(uuid,text),public.club_settings_people(uuid),public.add_club_coach(uuid,uuid),public.create_managed_club(text) to authenticated;
commit;
