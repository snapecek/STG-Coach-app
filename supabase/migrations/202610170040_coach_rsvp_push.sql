-- Web Push registrations belong to a user/device, never to a public club roster.
begin;
create table public.coach_push_subscriptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
 endpoint text not null unique check(length(endpoint) between 30 and 2048 and endpoint ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com)/[^?#[:space:]]+$'),
 p256dh text not null check(p256dh ~ '^[A-Za-z0-9_-]{87}$'),
 auth text not null check(auth ~ '^[A-Za-z0-9_-]{22}$'),updated_at timestamptz not null default now()
);
alter table public.coach_push_subscriptions enable row level security;
revoke all on public.coach_push_subscriptions from public,anon,authenticated;
create function public.register_coach_push(push_endpoint text,push_p256dh text,push_auth text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$declare sid uuid;begin
 if auth.uid() is null or not exists(select 1 from club_roles r join clubs c on c.id=r.club_id where r.user_id=auth.uid() and r.role in ('owner','coach') and c.archived_at is null) then raise insufficient_privilege;end if;
 insert into coach_push_subscriptions(user_id,endpoint,p256dh,auth) values(auth.uid(),push_endpoint,push_p256dh,push_auth)
 on conflict(endpoint) do update set user_id=auth.uid(),p256dh=excluded.p256dh,auth=excluded.auth,updated_at=now() returning id into sid;return sid;
end $$;
create function public.unregister_coach_push(push_endpoint text) returns void language sql security definer set search_path=public,pg_temp as $$delete from coach_push_subscriptions where user_id=auth.uid() and endpoint=push_endpoint$$;
create function public.coach_push_enabled(push_endpoint text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$select exists(select 1 from coach_push_subscriptions s where s.user_id=auth.uid() and s.endpoint=push_endpoint)$$;
revoke all on function public.register_coach_push(text,text,text),public.unregister_coach_push(text),public.coach_push_enabled(text) from public,anon;
grant execute on function public.register_coach_push(text,text,text),public.unregister_coach_push(text),public.coach_push_enabled(text) to authenticated;
create table public.coach_push_jobs(
 id bigint generated always as identity primary key,club_id uuid not null references clubs on delete cascade,
 event_id uuid not null references events on delete cascade,user_id uuid not null references auth.users on delete cascade,
 subscription_id uuid not null references coach_push_subscriptions on delete cascade,payload jsonb not null,
 created_at timestamptz not null default now(),available_at timestamptz not null default now(),attempts integer not null default 0,
 lease_token uuid,lease_until timestamptz,done_at timestamptz
);
create index coach_push_pending on public.coach_push_jobs(available_at,id) where done_at is null;
alter table public.coach_push_jobs enable row level security;
revoke all on public.coach_push_jobs from public,anon,authenticated;
-- Runs after seat rebalancing; nested allocation updates never create duplicate RSVP alerts.
create function public.queue_coach_rsvp_push() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare e events;m members;confirmed integer;waiting integer;answer_label text;seat text;club_name text;
begin
 if pg_trigger_depth()>1 or new.response is null or (tg_op='UPDATE' and new.response is not distinct from old.response) then return null;end if;
 select * into m from members where id=new.member_id and club_id=new.club_id and user_id=auth.uid() and removed_at is null and (purge_after is null or purge_after>now());
 if not found then return null;end if;
 select v.* into e from events v join clubs c on c.id=v.club_id where v.id=new.event_id and v.club_id=new.club_id and c.archived_at is null and v.status='scheduled' and v.completed_at is null and v.starts_at>now();
 if not found then return null;end if;
 select name into club_name from clubs where id=e.club_id;
 select seat_status into seat from participation where event_id=e.id and member_id=m.id;
 select count(*) filter(where p.response='yes' and (e.event_kind='race' or p.seat_status='confirmed')),
 count(*) filter(where p.response='yes' and p.seat_status='waiting') into confirmed,waiting
 from participation p join members x on x.id=p.member_id and x.club_id=p.club_id
 where p.event_id=e.id and x.removed_at is null and (x.purge_after is null or x.purge_after>now());
 answer_label:=case new.response when 'yes' then case when seat='waiting' then 'čeká na místo' when e.event_kind='race' then 'zúčastní se' else 'přijde' end when 'no' then case when e.event_kind='race' then 'nezúčastní se' else 'nepřijde' end when 'maybe' then 'možná' else 'doprovod' end;
 insert into coach_push_jobs(club_id,event_id,user_id,subscription_id,payload)
 select e.club_id,e.id,r.user_id,s.id,jsonb_build_object('memberLabel',m.name||' · '||answer_label,'expiresAt',e.starts_at,'title',club_name||' · '||e.name,'body',m.name||' · '||answer_label||'. Přihlášeno: '||confirmed||case when waiting>0 then ' · čeká: '||waiting else '' end||' · '||to_char(e.starts_at at time zone 'Europe/Prague','DD. MM. HH24:MI'),'url','/?push-club='||e.club_id||'&push-event='||e.id)
 from club_roles r join coach_push_subscriptions s on s.user_id=r.user_id
 where r.club_id=e.club_id and r.role in ('owner','coach') and r.user_id<>auth.uid();
 return null;
end $$;
create trigger zz_coach_rsvp_push after insert or update on public.participation for each row execute function public.queue_coach_rsvp_push();
revoke all on function public.queue_coach_rsvp_push() from public,anon,authenticated;
-- Worker-only leases prevent concurrent cron calls from claiming the same job.
create function public.claim_coach_push_jobs(batch_size integer default 20) returns table(job_id bigint,token uuid,endpoint text,p256dh text,auth text,payload jsonb) language plpgsql security definer set search_path=public,pg_temp as $$begin
 delete from coach_push_jobs where created_at<now()-interval '7 days';
 update coach_push_jobs j set done_at=now() where j.done_at is null and (j.attempts>=5 or j.created_at<now()-interval '1 day' or not exists(select 1 from events e join clubs c on c.id=e.club_id join club_roles r on r.club_id=c.id join coach_push_subscriptions s on s.id=j.subscription_id and s.user_id=j.user_id where e.id=j.event_id and e.starts_at>now() and e.status='scheduled' and e.completed_at is null and c.archived_at is null and r.user_id=j.user_id and r.role in ('owner','coach'))) and (j.lease_until is null or j.lease_until<now());
 return query with selected as (select j.id from coach_push_jobs j where j.done_at is null and j.available_at<=now() and (j.lease_until is null or j.lease_until<now()) order by j.id for update skip locked limit greatest(1,least(coalesce(batch_size,20),100))),claimed as (update coach_push_jobs j set attempts=j.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes' from selected x where j.id=x.id returning j.*)
 select j.id,j.lease_token,s.endpoint,s.p256dh,s.auth,(j.payload-'memberLabel')||jsonb_build_object('tag','trenomi-rsvp-'||j.id,'expiresAt',e.starts_at,'body',(j.payload->>'memberLabel')||'. Přihlášeno: '||totals.confirmed||case when totals.waiting>0 then ' · čeká: '||totals.waiting else '' end||' · '||to_char(e.starts_at at time zone 'Europe/Prague','DD. MM. HH24:MI'))
 from claimed j join coach_push_subscriptions s on s.id=j.subscription_id join events e on e.id=j.event_id
 cross join lateral(select count(*) filter(where p.response='yes' and (e.event_kind='race' or p.seat_status='confirmed')) as confirmed,count(*) filter(where p.response='yes' and p.seat_status='waiting') as waiting from participation p join members m on m.id=p.member_id and m.club_id=p.club_id where p.event_id=e.id and m.removed_at is null and (m.purge_after is null or m.purge_after>now())) totals;
end $$;
create function public.finish_coach_push_job(target_job bigint,expected_token uuid,outcome text) returns void language plpgsql security definer set search_path=public,pg_temp as $$declare j coach_push_jobs;begin
 if outcome not in ('sent','expired','retry') or outcome is null then raise exception 'Invalid outcome';end if;
 select * into j from coach_push_jobs where id=target_job and lease_token=expected_token and done_at is null for update;
 if not found then return;end if;
 if outcome='expired' then delete from coach_push_subscriptions s where s.id=j.subscription_id and s.user_id=j.user_id and s.updated_at<=j.created_at;end if;
 update coach_push_jobs set done_at=case when outcome<>'retry' or attempts>=5 then now() else null end,available_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)),lease_token=null,lease_until=null where id=j.id;
end $$;
revoke all on function public.claim_coach_push_jobs(integer),public.finish_coach_push_job(bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_coach_push_jobs(integer),public.finish_coach_push_job(bigint,uuid,text) to service_role;
commit;
