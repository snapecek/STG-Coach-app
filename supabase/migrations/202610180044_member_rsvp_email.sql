-- One automatic unanswered-RSVP reminder per member and event occurrence.
begin;
create table public.member_rsvp_email_jobs(
 id bigint generated always as identity primary key,
 club_id uuid not null references public.clubs on delete cascade,
 event_id uuid not null references public.events on delete cascade,
 member_id uuid not null references public.members on delete cascade,
 starts_at timestamptz not null,
 created_at timestamptz not null default now(),available_at timestamptz not null default now(),
 attempts integer not null default 0,lease_token uuid,lease_until timestamptz,
 done_at timestamptz,outcome text check(outcome in ('sent','skipped','failed')),
 unique(event_id,member_id,starts_at)
);
alter table public.member_rsvp_email_jobs enable row level security;
revoke all on public.member_rsvp_email_jobs from public,anon,authenticated;
create index member_rsvp_email_pending on public.member_rsvp_email_jobs(available_at,id) where done_at is null;
create index event_rsvp_email_due on public.events(starts_at) where status='scheduled' and completed_at is null;
-- Same visibility as the member calendar: open events for all active members,
-- restricted events only for their roster. Any RSVP (including maybe/no) counts.
-- The one-hour catch-up window avoids sending stale mail after long outages.
create function public.eligible_member_rsvp_emails() returns table(club_id uuid,event_id uuid,member_id uuid,starts_at timestamptz,email text,member_name text,club_name text,event_name text,place text,event_kind text)
language sql stable security definer set search_path=public,pg_temp as $$
 select c.id,e.id,m.id,e.starts_at,u.email,m.name,c.name,e.name,e.place,e.event_kind
 from events e join clubs c on c.id=e.club_id
 join members m on m.club_id=c.id join auth.users u on u.id=m.user_id
 where c.archived_at is null and e.status='scheduled' and e.completed_at is null
 and e.starts_at>now()+interval '23 hours' and e.starts_at<=now()+interval '24 hours'
 and m.kind='member' and m.removed_at is null and (m.purge_after is null or m.purge_after>now())
 and u.email is not null and length(trim(u.email))>0 and u.email_confirmed_at is not null
 and exists(select 1 from club_roles r where r.club_id=c.id and r.user_id=u.id and r.role in ('owner','coach','member'))
 and (not e.roster_only or exists(select 1 from participation p where p.club_id=c.id and p.event_id=e.id and p.member_id=m.id))
 and not exists(select 1 from participation p where p.club_id=c.id and p.event_id=e.id and p.member_id=m.id and p.response is not null)
$$;
create function public.claim_member_rsvp_email_jobs(batch_size integer default 10) returns table(job_id bigint,token uuid)
language plpgsql security definer set search_path=public,pg_temp as $$begin
 delete from member_rsvp_email_jobs where starts_at<now()-interval '30 days';
 insert into member_rsvp_email_jobs(club_id,event_id,member_id,starts_at)
 select e.club_id,e.event_id,e.member_id,e.starts_at from eligible_member_rsvp_emails() e on conflict do nothing;
 update member_rsvp_email_jobs j set done_at=now(),outcome=case when j.attempts>=5 then 'failed' else 'skipped' end
 where j.done_at is null and (j.lease_until is null or j.lease_until<now())
 and (j.attempts>=5 or not exists(select 1 from eligible_member_rsvp_emails() e where e.club_id=j.club_id and e.event_id=j.event_id and e.member_id=j.member_id and e.starts_at=j.starts_at));
 return query with selected as (
  select j.id from member_rsvp_email_jobs j where j.done_at is null and j.available_at<=now() and (j.lease_until is null or j.lease_until<now()) order by j.id for update skip locked limit greatest(1,least(coalesce(batch_size,10),50))
 ), claimed as (
  update member_rsvp_email_jobs j set attempts=j.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '3 minutes' from selected s where j.id=s.id returning j.id,j.lease_token
 ) select claimed.id,claimed.lease_token from claimed;
end $$;
-- Called immediately before each send: withdraw answered/cancelled/removed jobs
-- and resolve the CURRENT verified account, not an address supplied by a client.
create function public.prepare_member_rsvp_email(target_job bigint,expected_token uuid)
returns table(club_id uuid,event_id uuid,member_id uuid,starts_at timestamptz,email text,member_name text,club_name text,event_name text,place text,event_kind text)
language sql stable security definer set search_path=public,pg_temp as $$
 select e.* from member_rsvp_email_jobs j join eligible_member_rsvp_emails() e
 on e.club_id=j.club_id and e.event_id=j.event_id and e.member_id=j.member_id and e.starts_at=j.starts_at
 where j.id=target_job and j.lease_token=expected_token and j.lease_until>now() and j.done_at is null
$$;
create function public.finish_member_rsvp_email(target_job bigint,expected_token uuid,result text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$begin
 if result is null or result not in ('sent','skipped','retry') then raise exception 'Invalid outcome';end if;
 update member_rsvp_email_jobs j set
 done_at=case when result<>'retry' or j.attempts>=5 then now() else null end,
 outcome=case when result='retry' then case when j.attempts>=5 then 'failed' else null end else result end,
 available_at=now()+make_interval(secs=>least(900,30*power(2,j.attempts)::integer)),lease_token=null,lease_until=null
 where j.id=target_job and j.lease_token=expected_token and j.done_at is null;
end $$;
revoke all on function public.eligible_member_rsvp_emails(),public.claim_member_rsvp_email_jobs(integer),public.prepare_member_rsvp_email(bigint,uuid),public.finish_member_rsvp_email(bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_member_rsvp_email_jobs(integer),public.prepare_member_rsvp_email(bigint,uuid),public.finish_member_rsvp_email(bigint,uuid,text) to service_role;
commit;
