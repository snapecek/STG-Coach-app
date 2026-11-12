begin;
insert into auth.users(id) select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,6)n;
insert into clubs(id,name) values('20000000-0000-4000-8000-000000000001','Klub nových událostí'),('20000000-0000-4000-8000-000000000002','Cizí klub');
insert into club_roles values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','member'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','coach'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000005','owner');
insert into members(id,club_id,user_id,name,kind) select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001',('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Člen '||n,'member' from generate_series(2,3)n;
insert into training_groups(id,club_id,name) values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Skupina');
insert into training_group_members values('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002');
create function pg_temp.session_input(eid uuid) returns jsonb language sql as $$select jsonb_build_object('id',eid,'name','Nový běh','place','Park','type','Běh','plan','','starts_at',now()+interval '2 days','duration_minutes',60)$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
select register_event_push('https://fcm.googleapis.com/fcm/send/new-event-member',repeat('A',87),repeat('A',22));
do $$begin
 begin perform create_training_series_with_notice('20000000-0000-4000-8000-000000000001',jsonb_build_array(pg_temp.session_input('50000000-0000-4000-8000-000000000001')));raise exception 'FAIL member create';exception when insufficient_privilege then null;end;
 begin perform queue_event_created_notices('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001');raise exception 'FAIL public announcement helper';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004"}',true);
select register_event_push('https://web.push.apple.com/new-event-coach',repeat('B',87),repeat('B',22));
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
-- Original RPCs (unchecked option / older clients) remain silent.
select * from create_training_series('20000000-0000-4000-8000-000000000001',jsonb_build_array(pg_temp.session_input('50000000-0000-4000-8000-000000000001')));
reset role;
do $$begin if exists(select 1 from event_change_notices) then raise exception 'FAIL unchecked creation notified';end if;end $$;
set local role authenticated;
select * from create_training_series_with_notice('20000000-0000-4000-8000-000000000001',jsonb_build_array(pg_temp.session_input('50000000-0000-4000-8000-000000000002')));
reset role;
do $$begin
 if (select count(*) from event_change_notices)<>4 then raise exception 'FAIL creation recipients';end if;
 if (select count(*) from coach_push_jobs where notice_id is not null)<>2 then raise exception 'FAIL creation device routing';end if;
 if not exists(select 1 from event_change_notices where body like 'Nový trénink%Park%' and title like '%Nový běh%') then raise exception 'FAIL creation content';end if;
 if exists(select 1 from event_change_notices where user_id='10000000-0000-4000-8000-000000000005') then raise exception 'FAIL foreign recipient';end if;
end $$;
set local role authenticated;
-- The same client-generated event identity cannot create duplicate announcements.
do $$begin
 begin perform create_training_series_with_notice('20000000-0000-4000-8000-000000000001',jsonb_build_array(pg_temp.session_input('50000000-0000-4000-8000-000000000002')));raise exception 'FAIL duplicate creation accepted';exception when unique_violation then null;end;
 begin perform create_training_series_with_notice('20000000-0000-4000-8000-000000000002',jsonb_build_array(pg_temp.session_input('50000000-0000-4000-8000-000000000003')));raise exception 'FAIL foreign creation';exception when insufficient_privilege then null;end;
 -- A failure in the second session must undo the first event, notices and jobs.
 begin perform create_training_series_with_notice('20000000-0000-4000-8000-000000000001',jsonb_build_array(pg_temp.session_input('50000000-0000-4000-8000-000000000003'),pg_temp.session_input('50000000-0000-4000-8000-000000000004')||'{"duration_minutes":0}'));raise exception 'FAIL invalid series accepted';exception when check_violation then null;end;
end $$;
reset role;
do $$begin
 if exists(select 1 from events where id in ('50000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000004')) then raise exception 'FAIL partial creation';end if;
 if (select count(*) from event_change_notices)<>4 or (select count(*) from coach_push_jobs)<>2 then raise exception 'FAIL duplicate or rollback notices';end if;
end $$;
set local role authenticated;
-- Group recipients are selected AFTER the original group RPC has stored the roster.
select * from create_group_trainings_with_notice('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',jsonb_build_array(pg_temp.session_input('50000000-0000-4000-8000-000000000005')));
reset role;
do $$begin
 if (select count(*) from event_change_notices where event_id='50000000-0000-4000-8000-000000000005')<>3 then raise exception 'FAIL group roster not ready';end if;
 if exists(select 1 from event_change_notices where event_id='50000000-0000-4000-8000-000000000005' and user_id='10000000-0000-4000-8000-000000000003') then raise exception 'FAIL nonroster creation recipient';end if;
 if not exists(select 1 from participation where event_id='50000000-0000-4000-8000-000000000005' and member_id='30000000-0000-4000-8000-000000000002') then raise exception 'FAIL group roster lost';end if;
end $$;
set local role authenticated;
-- Open races reach active members even with no selected entrants; draft guests survive.
select create_club_race_with_notice('20000000-0000-4000-8000-000000000001',pg_temp.session_input('50000000-0000-4000-8000-000000000006')||'{"name":"Nový závod","guests":[{"name":"Nový doprovod","role":"companion"}]}',array[]::uuid[]);
reset role;
do $$begin
 if (select count(*) from event_change_notices where event_id='50000000-0000-4000-8000-000000000006')<>4 then raise exception 'FAIL race recipients';end if;
 if not exists(select 1 from event_change_notices where event_id='50000000-0000-4000-8000-000000000006' and body like 'Nový závod%') then raise exception 'FAIL race label';end if;
 if (select count(*) from participation where event_id='50000000-0000-4000-8000-000000000006' and response='companion')<>1 then raise exception 'FAIL race guests';end if;
end $$;
set local role authenticated;
-- A series produces one notice for each real new event, keeping event deep links.
select * from create_training_series_with_notice('20000000-0000-4000-8000-000000000001',jsonb_build_array(pg_temp.session_input('50000000-0000-4000-8000-000000000007'),pg_temp.session_input('50000000-0000-4000-8000-000000000008')));
reset role;
do $$begin if (select count(*) from event_change_notices where event_id in ('50000000-0000-4000-8000-000000000007','50000000-0000-4000-8000-000000000008'))<>8 then raise exception 'FAIL series creation notices';end if;end $$;
set local role service_role;
select set_config('stg.created_jobs',(select jsonb_agg(to_jsonb(j))::text from claim_coach_push_jobs(100)j),true);
do $$begin
 if jsonb_array_length(current_setting('stg.created_jobs')::jsonb)<>10 then raise exception 'FAIL new-event push jobs';end if;
 if exists(select 1 from jsonb_array_elements(current_setting('stg.created_jobs')::jsonb)j where j->'payload'->>'url' not like '%push-kind=change') then raise exception 'FAIL new-event navigation';end if;
end $$;
rollback;
