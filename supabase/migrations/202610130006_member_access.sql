begin;
create extension if not exists pgcrypto;
-- One identity per club; do not merge any historical member records automatically.
create unique index members_club_identity on public.members(club_id,user_id) where user_id is not null;
create table public.club_invitations(
 id uuid primary key default gen_random_uuid(), club_id uuid not null, member_id uuid not null,
 email text not null check(length(email)<=254 and email=lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 token_hash text unique not null, created_by uuid references auth.users, created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days', accepted_at timestamptz, revoked_at timestamptz,
 foreign key(club_id,member_id) references public.members(club_id,id) on delete cascade
);
alter table public.club_invitations enable row level security;
revoke all on public.club_invitations from anon,authenticated;
grant select on public.club_invitations to authenticated;
create policy invitations_staff_read on public.club_invitations for select to authenticated using(public.has_club_role(club_id,array['owner','coach']) and exists(select 1 from public.members m where m.id=member_id and m.club_id=club_invitations.club_id));
create function public.issue_club_invitation(target_club uuid,target_member uuid,target_email text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare m public.members;secret text;invitation_id uuid;normalized text:=lower(trim(target_email));
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select * into m from public.members where id=target_member and club_id=target_club and removed_at is null and (purge_after is null or purge_after>now()) for update;
 if not found or m.user_id is not null then raise exception 'Member unavailable or already linked';end if;
 if normalized is null or length(normalized)>254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email';end if;
 if (select count(*) from public.club_invitations where created_by=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'Invitation limit reached; try later';end if;
 update public.club_invitations set revoked_at=now() where club_id=target_club and member_id=target_member and accepted_at is null and revoked_at is null;
 secret:=encode(gen_random_bytes(32),'hex');
 insert into public.club_invitations(club_id,member_id,email,token_hash,created_by) values(target_club,target_member,normalized,encode(digest(secret,'sha256'),'hex'),auth.uid()) returning id into invitation_id;
 return jsonb_build_object('id',invitation_id,'token',secret,'expires_at',now()+interval '7 days');
end $$;
create function public.revoke_club_invitation(invitation_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare target uuid;
begin
 select club_id into target from public.club_invitations where id=invitation_id;
 if target is null or not public.has_club_role(target,array['owner','coach']) then raise insufficient_privilege;end if;
 update public.club_invitations set revoked_at=now() where id=invitation_id and accepted_at is null;
end $$;
create function public.accept_club_invitation(invitation_token text) returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare inv public.club_invitations;m public.members;verified_email text;
begin
 if auth.uid() is null or invitation_token !~ '^[0-9a-f]{64}$' then raise exception 'Invitation unavailable';end if;
 select lower(email) into verified_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 select * into inv from public.club_invitations where token_hash=encode(digest(invitation_token,'sha256'),'hex') for update;
 if not found or verified_email is null or verified_email<>inv.email or inv.expires_at<=now() or inv.revoked_at is not null or inv.accepted_at is not null then raise exception 'Invitation unavailable';end if;
 select * into m from public.members where id=inv.member_id and club_id=inv.club_id for update;
 if not found or m.removed_at is not null or (m.purge_after is not null and m.purge_after<=now()) or (m.user_id is not null and m.user_id<>auth.uid()) then raise exception 'Member unavailable';end if;
 if exists(select 1 from public.members where club_id=inv.club_id and user_id=auth.uid() and id<>m.id) then raise exception 'This account already has a member record; ask the coach';end if;
 update public.members set user_id=auth.uid() where id=m.id;
 insert into public.club_roles(club_id,user_id,role) values(inv.club_id,auth.uid(),'member') on conflict do nothing;
 update public.club_invitations set accepted_at=now() where id=inv.id;
 return inv.club_id;
end $$;
create function public.my_club_member(target_club uuid) returns table(id uuid,name text,kind text) language sql stable security definer set search_path=public as $$
 select m.id,m.name,m.kind from public.members m where m.club_id=target_club and m.user_id=auth.uid() and m.removed_at is null and (m.purge_after is null or m.purge_after>now()) and public.has_club_role(target_club,array['owner','coach','member']);
$$;
create function public.my_club_participation(target_club uuid) returns setof public.participation language sql stable security definer set search_path=public as $$
 select p.* from public.participation p join public.members m on m.id=p.member_id and m.club_id=p.club_id where p.club_id=target_club and m.user_id=auth.uid() and m.removed_at is null and (m.purge_after is null or m.purge_after>now()) and public.has_club_role(target_club,array['owner','coach','member']);
$$;
create function public.respond_to_club_event(target_club uuid,target_event uuid,answer text) returns public.participation language plpgsql security definer set search_path=public as $$
declare m public.members;e public.events;result public.participation;
begin
 if not public.has_club_role(target_club,array['owner','coach','member']) then raise insufficient_privilege;end if;
 if answer is null or answer not in ('yes','no','maybe') then raise exception 'Invalid response';end if;
 select * into m from public.members where club_id=target_club and user_id=auth.uid() and removed_at is null and (purge_after is null or purge_after>now()) for update;
 if not found then raise exception 'No linked active member';end if;
 select * into e from public.events where id=target_event and club_id=target_club for update;
 if not found or e.status<>'scheduled' or e.starts_at<=now() or e.completed_at is not null then raise exception 'RSVP closed';end if;
 if e.event_kind='race' and not exists(select 1 from public.participation where event_id=e.id and member_id=m.id) then raise exception 'Not on the race roster';end if;
 insert into public.participation(club_id,event_id,member_id,response) values(target_club,e.id,m.id,answer) on conflict(event_id,member_id) do update set response=excluded.response returning * into result;
 return result;
end $$;
revoke all on function public.issue_club_invitation(uuid,uuid,text),public.revoke_club_invitation(uuid),public.accept_club_invitation(text),public.my_club_member(uuid),public.my_club_participation(uuid),public.respond_to_club_event(uuid,uuid,text) from public,anon;
grant execute on function public.issue_club_invitation(uuid,uuid,text),public.revoke_club_invitation(uuid),public.accept_club_invitation(text),public.my_club_member(uuid),public.my_club_participation(uuid),public.respond_to_club_event(uuid,uuid,text) to authenticated;
commit;
