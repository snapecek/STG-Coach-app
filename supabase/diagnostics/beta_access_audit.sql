-- READ ONLY: run in Supabase SQL Editor with an administrative database role.
-- Does not create, change, archive or delete any club, account or permission.
-- 3521... is the verified STG Karvina club identity, not a password or token.

-- 1. All clubs, their owners and approval evidence, including archived clubs.
with main_owners as (
 select r.user_id from public.club_roles r
 where r.club_id='3521a630-cbc2-4027-97e6-e490a1bc4f41'::uuid and r.role='owner'
), approved_accounts as (
 select user_id from main_owners
 union
 select q.applicant_id from public.club_join_requests q
 where q.status='approved' and q.reviewed_by in (select user_id from main_owners)
 union
 select m.user_id from public.members m join public.club_invitations i
 on i.club_id=m.club_id and i.member_id=m.id
 join auth.users accepted_user on accepted_user.id=m.user_id and lower(accepted_user.email)=i.email
 where i.accepted_at is not null and i.created_by in (select user_id from main_owners) and m.user_id is not null
)
select c.id,c.name,c.created_at,c.archived_at,
 (select count(*) from public.members m where m.club_id=c.id and m.removed_at is null) as active_member_records,
 (select jsonb_agg(jsonb_build_object('account_id',r.user_id,'email',u.email,
  'approval_record_exists',exists(select 1 from approved_accounts a where a.user_id=r.user_id)))
  from public.club_roles r left join auth.users u on u.id=r.user_id where r.club_id=c.id and r.role='owner') as owners,
 case
  when not exists(select 1 from public.club_roles r where r.club_id=c.id and r.role='owner') then 'Review: no owner'
  when exists(select 1 from public.club_roles r where r.club_id=c.id and r.role='owner'
   and not exists(select 1 from approved_accounts a where a.user_id=r.user_id)) then 'Review: owner has no approval record'
  else 'Owner approval record found'
 end as review_status
from public.clubs c order by c.created_at,c.id;

-- 2. Auth accounts without evidence of approval by the STG owner.
-- Missing historical evidence is a reason to review, not proof of unauthorized access.
with main_owners as (
 select r.user_id from public.club_roles r
 where r.club_id='3521a630-cbc2-4027-97e6-e490a1bc4f41'::uuid and r.role='owner'
), approved_accounts as (
 select user_id from main_owners
 union
 select q.applicant_id from public.club_join_requests q
 where q.status='approved' and q.reviewed_by in (select user_id from main_owners)
 union
 select m.user_id from public.members m join public.club_invitations i
 on i.club_id=m.club_id and i.member_id=m.id
 join auth.users accepted_user on accepted_user.id=m.user_id and lower(accepted_user.email)=i.email
 where i.accepted_at is not null and i.created_by in (select user_id from main_owners) and m.user_id is not null
)
select u.id,u.email,u.created_at,u.email_confirmed_at,u.last_sign_in_at,
 (select jsonb_agg(jsonb_build_object('club',c.name,'role',r.role,'club_archived_at',c.archived_at))
  from public.club_roles r join public.clubs c on c.id=r.club_id where r.user_id=u.id) as memberships,
 exists(select 1 from public.club_join_requests q where q.applicant_id=u.id and q.status='pending') as has_pending_application
from auth.users u
where not exists(select 1 from approved_accounts a where a.user_id=u.id)
order by u.created_at,u.id;
