begin;
-- Existing memberships, guests and direct member invitations remain unchanged.
alter table public.clubs add column applications_open boolean not null default false;
create table public.club_join_invitations(
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs on delete cascade,
 email text not null check(length(email)<=254 and email=lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 token_hash text unique not null,created_by uuid references auth.users on delete set null,
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null default now()+interval '7 days',
 sent_at timestamptz,submitted_at timestamptz,revoked_at timestamptz
);
create table public.club_join_requests(
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs on delete cascade,
 applicant_id uuid not null references auth.users on delete cascade,email text not null,
 first_name text not null check(length(trim(first_name)) between 1 and 80 and first_name !~ '[[:cntrl:]]'),
 last_name text not null check(length(trim(last_name)) between 1 and 80 and last_name !~ '[[:cntrl:]]'),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default clock_timestamp(),reviewed_at timestamptz,reviewed_by uuid references auth.users on delete set null,
 member_id uuid references public.members(id) on delete set null
);
create unique index one_pending_club_application on public.club_join_requests(club_id,applicant_id) where status='pending';
create index join_invitations_actor on public.club_join_invitations(created_by,created_at);
create index join_requests_applicant on public.club_join_requests(applicant_id,created_at desc);
create index join_requests_staff on public.club_join_requests(club_id,status,created_at);
alter table public.club_join_invitations enable row level security;
alter table public.club_join_requests enable row level security;
revoke all on public.club_join_invitations,public.club_join_requests from public,anon,authenticated;
grant select(id,club_id,email,created_at,expires_at,sent_at,submitted_at,revoked_at) on public.club_join_invitations to authenticated;
grant select on public.club_join_requests to authenticated;
create policy join_invitations_staff on public.club_join_invitations for select to authenticated using(public.has_club_role(club_id,array['owner','coach']));
create policy join_requests_read on public.club_join_requests for select to authenticated using(public.has_club_role(club_id,array['owner','coach']));
create trigger club_archive_write_guard before insert or update or delete on public.club_join_invitations for each row execute function public.guard_active_club_data();
create trigger club_archive_write_guard before insert or update or delete on public.club_join_requests for each row execute function public.guard_active_club_data();
create function public.get_club_admissions(target_club uuid) returns boolean language plpgsql stable security definer set search_path=public as $$begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 return (select applications_open from clubs where id=target_club);
end $$;
create function public.set_club_admissions(target_club uuid,enabled boolean) returns void language plpgsql security definer set search_path=public as $$begin
 if not public.has_club_role(target_club,array['owner']) then raise insufficient_privilege;end if;
 update clubs set applications_open=enabled where id=target_club;
end $$;
create function public.issue_join_invitation(target_club uuid,target_email text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$declare secret text;issued uuid;normalized text:=lower(trim(target_email));begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 if normalized is null or length(normalized)>254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email';end if;
 perform pg_advisory_xact_lock(hashtextextended('join-invite:'||auth.uid()::text,0));
 if (select count(*) from club_join_invitations where created_by=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'Invitation limit reached';end if;
 update club_join_invitations set revoked_at=clock_timestamp() where club_id=target_club and email=normalized and submitted_at is null and revoked_at is null;
 secret:=encode(gen_random_bytes(32),'hex');
 insert into club_join_invitations(club_id,email,token_hash,created_by) values(target_club,normalized,encode(digest(secret,'sha256'),'hex'),auth.uid()) returning id into issued;
 return jsonb_build_object('id',issued,'token',secret);
end $$;
create function public.revoke_join_invitation(invitation_id uuid) returns void language plpgsql security definer set search_path=public as $$declare target uuid;begin
 select club_id into target from club_join_invitations where id=invitation_id;
 if target is null or not public.has_club_role(target,array['owner','coach']) then raise insufficient_privilege;end if;
 update club_join_invitations set revoked_at=clock_timestamp() where id=invitation_id and submitted_at is null;
end $$;
create function public.mark_join_invitation_sent(invitation_id uuid) returns void language plpgsql security definer set search_path=public as $$declare target uuid;begin
 select club_id into target from club_join_invitations where id=invitation_id;
 if target is null or not public.has_club_role(target,array['owner','coach']) then raise insufficient_privilege;end if;
 update club_join_invitations set sent_at=clock_timestamp() where id=invitation_id and revoked_at is null;
end $$;
-- No anonymous directory: club names are only listed to signed-in users and
-- only after an owner opts in, or for a valid invitation bound to verified email.
create function public.joinable_clubs(invitation_token text default null) returns table(id uuid,name text,invited boolean) language plpgsql stable security definer set search_path=public,extensions as $$declare verified text;begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 select lower(u.email) into verified from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 return query select c.id,c.name,exists(select 1 from club_join_invitations i where i.club_id=c.id and i.email=verified and i.token_hash=encode(digest(invitation_token,'sha256'),'hex') and i.expires_at>now() and i.revoked_at is null and i.submitted_at is null)
 from clubs c where c.archived_at is null and not exists(select 1 from members m where m.club_id=c.id and m.user_id=auth.uid() and m.removed_at is null and (m.purge_after is null or m.purge_after>now())) and (c.applications_open or exists(select 1 from club_join_invitations i where i.club_id=c.id and i.email=verified and i.token_hash=encode(digest(invitation_token,'sha256'),'hex') and i.expires_at>now() and i.revoked_at is null and i.submitted_at is null)) order by c.name;
end $$;
create function public.submit_club_application(target_club uuid,given_name text,family_name text,invitation_token text default null) returns uuid language plpgsql security definer set search_path=public,extensions as $$declare verified text;inv uuid;existing uuid;result uuid;begin
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
 if inv is null and not (select applications_open from clubs where id=target_club) then raise insufficient_privilege;end if;
 if (select count(*) from club_join_requests where applicant_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then raise exception 'Application limit reached';end if;
 insert into club_join_requests(club_id,applicant_id,email,first_name,last_name) values(target_club,auth.uid(),verified,trim(given_name),trim(family_name)) returning id into result;
 if inv is not null then update club_join_invitations set submitted_at=clock_timestamp() where id=inv;end if;
 return result;
end $$;
create function public.my_club_applications() returns table(id uuid,club_id uuid,club_name text,status text,created_at timestamptz) language sql stable security definer set search_path=public as $$
 select distinct on(r.club_id) r.id,r.club_id,c.name,r.status,r.created_at from club_join_requests r join clubs c on c.id=r.club_id where r.applicant_id=auth.uid() and c.archived_at is null order by r.club_id,r.created_at desc,r.id;
$$;
create function public.review_club_application(target_request uuid,approve boolean,target_member uuid default null) returns uuid language plpgsql security definer set search_path=public as $$declare r club_join_requests;target uuid;chosen uuid;verified text;begin
 if approve is null then raise exception 'Invalid review';end if;
 select club_id into target from club_join_requests where id=target_request;
 if target is null then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended('club-state:'||target::text,0));
 if not public.has_club_role(target,array['owner','coach']) then raise insufficient_privilege;end if;
 select * into r from club_join_requests where id=target_request for update;
 if r.status='approved' and approve then return r.member_id;end if;
 if r.status<>'pending' then raise exception 'Application already reviewed';end if;
 if approve then
  select lower(email) into verified from auth.users where id=r.applicant_id and email_confirmed_at is not null;
  if verified is distinct from r.email then raise exception 'Applicant email changed';end if;
  select id into chosen from members where club_id=target and user_id=r.applicant_id for update;
  if chosen is not null and exists(select 1 from members where id=chosen and purge_after<=now()) then raise exception 'Member unavailable';end if;
  if target_member is not null then
   if chosen is not null and chosen<>target_member then raise exception 'Account already linked';end if;
   if not exists(select 1 from members where id=target_member and club_id=target and (purge_after is null or purge_after>now()) and (user_id is null or user_id=r.applicant_id)) then raise exception 'Member unavailable';end if;
   chosen:=target_member;
  end if;
  if chosen is null then insert into members(club_id,user_id,name,kind) values(target,r.applicant_id,r.first_name||' '||r.last_name,'member') returning id into chosen;
  else update members set user_id=r.applicant_id,name=r.first_name||' '||r.last_name,kind='member',removed_at=null,purge_after=null where id=chosen;end if;
  insert into club_roles(club_id,user_id,role) values(target,r.applicant_id,'member') on conflict do nothing;
 end if;
 update club_join_requests set status=case when approve then 'approved' else 'rejected' end,reviewed_at=clock_timestamp(),reviewed_by=auth.uid(),member_id=chosen where id=r.id;
 return chosen;
end $$;
revoke all on function public.get_club_admissions(uuid),public.set_club_admissions(uuid,boolean),public.issue_join_invitation(uuid,text),public.revoke_join_invitation(uuid),public.mark_join_invitation_sent(uuid),public.joinable_clubs(text),public.submit_club_application(uuid,text,text,text),public.my_club_applications(),public.review_club_application(uuid,boolean,uuid) from public,anon;
grant execute on function public.get_club_admissions(uuid),public.set_club_admissions(uuid,boolean),public.issue_join_invitation(uuid,text),public.revoke_join_invitation(uuid),public.mark_join_invitation_sent(uuid),public.joinable_clubs(text),public.submit_club_application(uuid,text,text,text),public.my_club_applications(),public.review_club_application(uuid,boolean,uuid) to authenticated;
commit;
