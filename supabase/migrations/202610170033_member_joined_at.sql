-- Preserve unknown historical dates rather than assigning the migration date.
begin;
alter table public.members add column joined_at timestamptz;
update public.members m set joined_at=known.joined_at
from (
 select club_id,member_id,min(joined_at) as joined_at from (
  select club_id,member_id,accepted_at as joined_at from public.club_invitations where accepted_at is not null
  union all
  select club_id,member_id,reviewed_at from public.club_join_requests where status='approved' and member_id is not null
 ) dates group by club_id,member_id
) known where m.club_id=known.club_id and m.id=known.member_id;
alter table public.members alter column joined_at set default clock_timestamp();
comment on column public.members.joined_at is 'Date added to the club register; historical rows use earliest known acceptance, otherwise NULL. Preserved on archive/restore.';
commit;
