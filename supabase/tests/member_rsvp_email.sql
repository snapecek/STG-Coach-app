begin;
insert into auth.users(id,email,email_confirmed_at) select ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'fictional'||i||'@example.invalid',case when i=7 then null else now() end from generate_series(1,9)i;
insert into clubs(id,name) values('20000000-0000-4000-8000-000000000001','Připomínkový klub');
insert into club_roles select '20000000-0000-4000-8000-000000000001',id,'member' from auth.users where id<>'10000000-0000-4000-8000-000000000008';
insert into members(id,club_id,user_id,name,kind,removed_at,purge_after)
select ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001',case when i=6 then null else ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid end,'Člen '||i,case when i=3 then 'guest' else 'member' end,case when i in (4,5) then now() end,case when i=5 then now()-interval '1 day' end from generate_series(1,8)i;
insert into events(id,club_id,name,starts_at,place,type,event_kind,roster_only,status,completed_at,group_name)
select ('50000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001','Událost '||i,
now()+case when i=4 then interval '25 hours' when i=5 then interval '22 hours' when i=7 then interval '-2 hours' else interval '24 hours' end,'Park','Běh',case when i=3 then 'race' else 'training' end,i=2,case when i=6 then 'cancelled' else 'scheduled' end,null,case when i=2 then 'Skupina' else '' end from generate_series(1,7)i;
insert into participation(club_id,event_id,member_id,response) values('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',null);
do $$begin
 if (select count(*) from eligible_member_rsvp_emails())<>5 then raise exception 'FAIL eligibility: expected 5, actual %',(select jsonb_agg(jsonb_build_object('event',event_name,'member',member_name)) from eligible_member_rsvp_emails());end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$begin
 begin perform claim_member_rsvp_email_jobs();raise exception 'FAIL client dispatched';exception when insufficient_privilege then null;end;
 begin perform eligible_member_rsvp_emails();raise exception 'FAIL email disclosure';exception when insufficient_privilege then null;end;
 begin perform 1 from member_rsvp_email_jobs;raise exception 'FAIL client job read';exception when insufficient_privilege then null;end;
end $$;
set local role service_role;
select set_config('test.email.first_count',(select count(*)::text from claim_member_rsvp_email_jobs(2)),true);
select set_config('test.email.next_count',(select count(*)::text from claim_member_rsvp_email_jobs(50)),true);
reset role;
do $$begin
 if current_setting('test.email.first_count')<>'2' or current_setting('test.email.next_count')<>'3' or (select count(*) from member_rsvp_email_jobs)<>5 then raise exception 'FAIL claiming or dedupe';end if;
 if exists(select 1 from claim_member_rsvp_email_jobs()) then raise exception 'FAIL duplicate lease';end if;
end $$;
select set_config('test.email.job',(select id::text from member_rsvp_email_jobs where event_id='50000000-0000-4000-8000-000000000001' and member_id='30000000-0000-4000-8000-000000000001'),true);
select set_config('test.email.token',(select lease_token::text from member_rsvp_email_jobs where id=current_setting('test.email.job')::bigint),true);
do $$begin
 if (select email from prepare_member_rsvp_email(current_setting('test.email.job')::bigint,current_setting('test.email.token')::uuid))<>'fictional1@example.invalid' then raise exception 'FAIL prepared recipient';end if;
 if exists(select 1 from prepare_member_rsvp_email(current_setting('test.email.job')::bigint,gen_random_uuid())) then raise exception 'FAIL stolen lease';end if;
end $$;
-- Every answer suppresses a reminder, even negative/maybe and race companion.
insert into participation(club_id,event_id,member_id,response) values('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','no');
do $$declare answer text;begin
 foreach answer in array array['no','maybe','yes'] loop
 update participation set response=answer where event_id='50000000-0000-4000-8000-000000000001' and member_id='30000000-0000-4000-8000-000000000001';
 if exists(select 1 from prepare_member_rsvp_email(current_setting('test.email.job')::bigint,current_setting('test.email.token')::uuid)) then raise exception 'FAIL answered reminder: %',answer;end if;
 end loop;
end $$;
update participation set response=null where event_id='50000000-0000-4000-8000-000000000001' and member_id='30000000-0000-4000-8000-000000000001';
insert into participation(club_id,event_id,member_id,response) values('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001','companion');
do $$begin if exists(select 1 from eligible_member_rsvp_emails() where event_id='50000000-0000-4000-8000-000000000003' and member_id='30000000-0000-4000-8000-000000000001') then raise exception 'FAIL companion reminder';end if;end $$;
-- Current identity/status, including answers made after claim, is rechecked.
update auth.users set email='changed@example.invalid' where id='10000000-0000-4000-8000-000000000001';
do $$begin if (select email from prepare_member_rsvp_email(current_setting('test.email.job')::bigint,current_setting('test.email.token')::uuid))<>'changed@example.invalid' then raise exception 'FAIL stale email';end if;end $$;
update members set removed_at=now() where id='30000000-0000-4000-8000-000000000001';
do $$begin if exists(select 1 from prepare_member_rsvp_email(current_setting('test.email.job')::bigint,current_setting('test.email.token')::uuid)) then raise exception 'FAIL removed recipient';end if;end $$;
update members set removed_at=null where id='30000000-0000-4000-8000-000000000001';
-- Removing a member intentionally sets future training RSVPs to no. Clear the
-- fixture's training answer again before testing retry delivery.
update participation set response=null where event_id='50000000-0000-4000-8000-000000000001' and member_id='30000000-0000-4000-8000-000000000001';
update events set status='cancelled' where id='50000000-0000-4000-8000-000000000001';
do $$begin if exists(select 1 from prepare_member_rsvp_email(current_setting('test.email.job')::bigint,current_setting('test.email.token')::uuid)) then raise exception 'FAIL cancelled event';end if;end $$;
update events set status='scheduled',starts_at=starts_at+interval '10 minutes' where id='50000000-0000-4000-8000-000000000001';
do $$begin if exists(select 1 from prepare_member_rsvp_email(current_setting('test.email.job')::bigint,current_setting('test.email.token')::uuid)) then raise exception 'FAIL changed occurrence';end if;end $$;
update events set starts_at=starts_at-interval '10 minutes' where id='50000000-0000-4000-8000-000000000001';
select finish_member_rsvp_email(current_setting('test.email.job')::bigint,gen_random_uuid(),'sent');
do $$begin if (select done_at from member_rsvp_email_jobs where id=current_setting('test.email.job')::bigint) is not null then raise exception 'FAIL stale acknowledgement';end if;end $$;
select finish_member_rsvp_email(current_setting('test.email.job')::bigint,current_setting('test.email.token')::uuid,'retry');
do $$begin if exists(select 1 from claim_member_rsvp_email_jobs()) then raise exception 'FAIL retry before backoff';end if;end $$;
update member_rsvp_email_jobs set available_at=now()-interval '1 second' where id=current_setting('test.email.job')::bigint;
do $$begin if (select count(*) from claim_member_rsvp_email_jobs())<>1 then raise exception 'FAIL retry lease';end if;end $$;
select finish_member_rsvp_email(current_setting('test.email.job')::bigint,(select lease_token from member_rsvp_email_jobs where id=current_setting('test.email.job')::bigint),'sent');
-- Delivered job is never re-created; expired leases for answered jobs are skipped.
update member_rsvp_email_jobs set lease_until=now()-interval '1 second' where done_at is null;
select count(*) from claim_member_rsvp_email_jobs();
do $$begin
 if (select count(*) from member_rsvp_email_jobs)<>5 then raise exception 'FAIL duplicate queue rows';end if;
 if (select outcome from member_rsvp_email_jobs where event_id='50000000-0000-4000-8000-000000000003' and member_id='30000000-0000-4000-8000-000000000001')<>'skipped' then raise exception 'FAIL answered job not withdrawn';end if;
end $$;
update member_rsvp_email_jobs set attempts=5,lease_until=now()-interval '1 second' where done_at is null;
select count(*) from claim_member_rsvp_email_jobs();
do $$begin if exists(select 1 from member_rsvp_email_jobs where done_at is null) then raise exception 'FAIL exhausted retries';end if;end $$;
update clubs set archived_at=now() where id='20000000-0000-4000-8000-000000000001';
do $$begin if exists(select 1 from eligible_member_rsvp_emails()) then raise exception 'FAIL archived club';end if;end $$;
rollback;
