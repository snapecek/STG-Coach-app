begin;
insert into auth.users(id) select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,5)n;
insert into clubs(id,name) values('20000000-0000-4000-8000-000000000001','Fiktivní push klub'),('20000000-0000-4000-8000-000000000002','Cizí klub');
insert into club_roles values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member'),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','coach'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','member');
insert into members(id,club_id,user_id,name,kind) values('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','První člen','member'),('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','Druhý člen','member');
insert into events(id,club_id,name,starts_at,place,type,capacity) values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Trénink',now()+interval '2 days','Park','Běh',1);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
select register_coach_push('https://fcm.googleapis.com/fcm/send/fictional-owner',repeat('A',87),repeat('A',22));
do $$begin
 if not coach_push_enabled('https://fcm.googleapis.com/fcm/send/fictional-owner') then raise exception 'FAIL status';end if;
 begin perform register_coach_push('https://example.invalid/ssrf',repeat('A',87),repeat('A',22));raise exception 'FAIL external endpoint';exception when check_violation then null;end;
 begin perform register_coach_push('https://fcm.googleapis.com.evil.invalid/ssrf',repeat('A',87),repeat('A',22));raise exception 'FAIL lookalike endpoint';exception when check_violation then null;end;
 begin perform * from claim_coach_push_jobs();raise exception 'FAIL authenticated worker';exception when insufficient_privilege then null;end;
 begin perform * from coach_push_subscriptions;raise exception 'FAIL subscription keys exposed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004"}',true);
select register_coach_push('https://web.push.apple.com/fictional-coach',repeat('B',87),repeat('B',22));
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 if coach_push_enabled('https://fcm.googleapis.com/fcm/send/fictional-owner') then raise exception 'FAIL foreign status';end if;
 begin perform register_coach_push('https://fcm.googleapis.com/fcm/send/fictional-member',repeat('A',87),repeat('A',22));raise exception 'FAIL member register';exception when insufficient_privilege then null;end;
end $$;
select (respond_to_club_event('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','yes')).response;
select (respond_to_club_event('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','yes')).response;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005"}',true);
select (respond_to_club_event('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','yes')).response;
reset role;
do $$begin
 if (select count(*) from coach_push_jobs)<>4 then raise exception 'FAIL repeated answer or nested seats duplicated jobs';end if;
 if not exists(select 1 from coach_push_jobs where payload->>'body' like 'Druhý člen · čeká na místo.%') then raise exception 'FAIL waitlist label';end if;
 if exists(select 1 from coach_push_jobs where user_id not in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004')) then raise exception 'FAIL wrong recipients';end if;
end $$;
-- Revoking a coach after enqueue must prevent subsequent delivery.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
select remove_club_coach('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004');
set local role service_role;
select set_config('stg.claimed',(select jsonb_agg(to_jsonb(x))::text from claim_coach_push_jobs(10)x),true);
do $$declare j jsonb;begin
 if jsonb_array_length(current_setting('stg.claimed')::jsonb)<>2 then raise exception 'FAIL revoked coach delivery';end if;
 if exists(select 1 from claim_coach_push_jobs()) then raise exception 'FAIL lease duplicated jobs';end if;
 for j in select value from jsonb_array_elements(current_setting('stg.claimed')::jsonb) loop
  if j->'payload'->>'body' not like '%Přihlášeno: 1 · čeká: 1%' then raise exception 'FAIL count not refreshed at delivery';end if;
  perform finish_coach_push_job((j->>'job_id')::bigint,gen_random_uuid(),'sent');
 end loop;
end $$;
reset role;
do $$begin if (select count(*) from coach_push_jobs where lease_token is not null and done_at is null)<>2 then raise exception 'FAIL stale token ack';end if;end $$;
set local role service_role;
select finish_coach_push_job((x->>'job_id')::bigint,(x->>'token')::uuid,'retry') from jsonb_array_elements(current_setting('stg.claimed')::jsonb)x;
reset role;
update coach_push_jobs set available_at=now() where done_at is null;
set local role service_role;
select set_config('stg.claimed',(select jsonb_agg(to_jsonb(x))::text from claim_coach_push_jobs(10)x),true);
select finish_coach_push_job((x->>'job_id')::bigint,(x->>'token')::uuid,'sent') from jsonb_array_elements(current_setting('stg.claimed')::jsonb)x;
reset role;
do $$begin if exists(select 1 from coach_push_jobs where done_at is null) then raise exception 'FAIL acknowledged jobs';end if;end $$;
-- Changing an answer queues fresh alerts; expired endpoints are removed.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
select (respond_to_club_event('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','no')).response;
set local role service_role;
select finish_coach_push_job(job_id,token,'expired') from claim_coach_push_jobs();
reset role;
do $$begin if exists(select 1 from coach_push_subscriptions where endpoint='https://fcm.googleapis.com/fcm/send/fictional-owner') then raise exception 'FAIL expired subscription retained';end if;end $$;
-- Explicit unsubscribe prevents subsequent jobs, without altering RSVP or attendance.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
select register_coach_push('https://fcm.googleapis.com/fcm/send/fictional-owner',repeat('A',87),repeat('A',22));
select unregister_coach_push('https://fcm.googleapis.com/fcm/send/fictional-owner');
do $$begin if coach_push_enabled('https://fcm.googleapis.com/fcm/send/fictional-owner') then raise exception 'FAIL unsubscribe';end if;end $$;
rollback;
