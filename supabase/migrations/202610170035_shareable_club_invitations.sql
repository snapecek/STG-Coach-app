begin;
-- An invitation link admits applicants to the existing review flow, never to club data.
create table public.club_join_links(
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs on delete cascade,
 token_hash text unique not null check(token_hash ~ '^[a-f0-9]{64}$'),created_by uuid references auth.users on delete set null,
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null default now()+interval '7 days',revoked_at timestamptz
);
create index club_join_links_club on public.club_join_links(club_id,created_at desc);
create index club_join_links_actor on public.club_join_links(created_by,created_at);
alter table public.club_join_links enable row level security;
revoke all on public.club_join_links from public,anon,authenticated;
grant select(id,club_id,created_at,expires_at,revoked_at) on public.club_join_links to authenticated;
create policy club_join_links_staff on public.club_join_links for select to authenticated using(public.has_club_role(club_id,array['owner','coach']));
create trigger club_archive_write_guard before insert or update or delete on public.club_join_links for each row execute function public.guard_active_club_data();
create function public.issue_join_link(target_club uuid) returns jsonb language plpgsql security definer set search_path=public,extensions as $$declare secret text;issued uuid;expires timestamptz;begin
 perform pg_advisory_xact_lock(hashtextextended('club-state:'||target_club::text,0));
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended('join-link:'||auth.uid()::text,0));
 if (select count(*) from club_join_links where created_by=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'Invitation limit reached';end if;
 secret:=encode(gen_random_bytes(32),'hex');
 insert into club_join_links(club_id,token_hash,created_by) values(target_club,encode(digest(secret,'sha256'),'hex'),auth.uid()) returning id,expires_at into issued,expires;
 return jsonb_build_object('id',issued,'token',secret,'expires_at',expires);
end $$;
create function public.revoke_join_link(invitation_id uuid) returns void language plpgsql security definer set search_path=public as $$declare target uuid;begin
 select club_id into target from club_join_links where id=invitation_id;
 if target is null then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended('club-state:'||target::text,0));
 if not public.has_club_role(target,array['owner','coach']) then raise insufficient_privilege;end if;
 update club_join_links set revoked_at=coalesce(revoked_at,clock_timestamp()) where id=invitation_id;
end $$;
create or replace function public.joinable_clubs(invitation_token text default null) returns table(id uuid,name text,invited boolean) language plpgsql stable security definer set search_path=public,extensions as $$declare verified text;begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 select lower(u.email) into verified from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 return query select c.id,c.name,(exists(select 1 from club_join_invitations i where i.club_id=c.id and i.email=verified and i.token_hash=encode(digest(invitation_token,'sha256'),'hex') and i.expires_at>now() and i.revoked_at is null and i.submitted_at is null) or exists(select 1 from club_join_links l where l.club_id=c.id and verified is not null and l.token_hash=encode(digest(invitation_token,'sha256'),'hex') and l.expires_at>now() and l.revoked_at is null))
 from clubs c where c.archived_at is null and not exists(select 1 from members m where m.club_id=c.id and m.user_id=auth.uid() and m.removed_at is null and (m.purge_after is null or m.purge_after>now())) and (c.applications_open or (exists(select 1 from club_join_invitations i where i.club_id=c.id and i.email=verified and i.token_hash=encode(digest(invitation_token,'sha256'),'hex') and i.expires_at>now() and i.revoked_at is null and i.submitted_at is null) or exists(select 1 from club_join_links l where l.club_id=c.id and verified is not null and l.token_hash=encode(digest(invitation_token,'sha256'),'hex') and l.expires_at>now() and l.revoked_at is null))) order by c.name;
end $$;
create or replace function public.submit_club_application(target_club uuid,given_name text,family_name text,invitation_token text default null) returns uuid language plpgsql security definer set search_path=public,extensions as $$declare verified text;inv uuid;share_inv uuid;existing uuid;result uuid;begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 select lower(u.email) into verified from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if verified is null then raise exception 'Verified email required';end if;
 if given_name is null or family_name is null or length(trim(given_name)) not between 1 and 80 or length(trim(family_name)) not between 1 and 80 or given_name ~ '[[:cntrl:]]' or family_name ~ '[[:cntrl:]]' then raise exception 'Invalid applicant name';end if;
 perform pg_advisory_xact_lock(hashtextextended('club-state:'||target_club::text,0));
 perform pg_advisory_xact_lock(hashtextextended('club-application:'||auth.uid()::text,0));
 if not exists(select 1 from clubs where id=target_club and archived_at is null) then raise insufficient_privilege;end if;
 if exists(select 1 from members where club_id=target_club and user_id=auth.uid() and removed_at is null and (purge_after is null or purge_after>now())) then raise exception 'Already a club member';end if;
 select id into existing from club_join_requests where club_id=target_club and applicant_id=auth.uid() and status='pending';
 if existing is not null then return existing;end if;
 select id into inv from club_join_invitations where club_id=target_club and email=verified and token_hash=encode(digest(invitation_token,'sha256'),'hex') and expires_at>now() and revoked_at is null and submitted_at is null for update;
 select id into share_inv from club_join_links where club_id=target_club and token_hash=encode(digest(invitation_token,'sha256'),'hex') and expires_at>now() and revoked_at is null for update;
 if inv is null and share_inv is null and not (select applications_open from clubs where id=target_club) then raise insufficient_privilege;end if;
 if (select count(*) from club_join_requests where applicant_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then raise exception 'Application limit reached';end if;
 insert into club_join_requests(club_id,applicant_id,email,first_name,last_name) values(target_club,auth.uid(),verified,trim(given_name),trim(family_name)) returning id into result;
 if inv is not null then update club_join_invitations set submitted_at=clock_timestamp() where id=inv;end if;
 return result;
end $$;
revoke all on function public.issue_join_link(uuid),public.revoke_join_link(uuid) from public,anon;
grant execute on function public.issue_join_link(uuid),public.revoke_join_link(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
