begin;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002'),('10000000-0000-4000-8000-000000000003');
insert into clubs(id,name) values ('20000000-0000-4000-8000-000000000001','Fiktivní úkoly');
insert into club_roles values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','coach'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','member');
insert into members(id,club_id,name,kind,user_id) values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fiktivní člen','member','10000000-0000-4000-8000-000000000002'),('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Jiný člen','member','10000000-0000-4000-8000-000000000003');
insert into events(id,club_id,name,starts_at,place,type) values ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fiktivní trénink',now()+interval '1 day','Park','Běh');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
insert into event_tasks(id,club_id,event_id,title,assignee_id) values ('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Pomůcky','30000000-0000-4000-8000-000000000001'),('60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Doprava','30000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 if exists(select 1 from public.event_tasks) then raise exception 'FAIL direct task registry access';end if;
 if (select count(*) from public.my_event_tasks('20000000-0000-4000-8000-000000000001'))<>1 then raise exception 'FAIL own tasks isolation';end if;
 begin perform public.complete_event_task('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002',true);raise exception 'FAIL other task completed';exception when insufficient_privilege then null;end;
end $$;
select public.complete_event_task('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',true);
do $$begin if not exists(select 1 from public.my_event_tasks('20000000-0000-4000-8000-000000000001') where completed_at is not null) then raise exception 'FAIL own completion';end if;end $$;
select public.complete_event_task('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$begin if exists(select 1 from event_tasks where id='60000000-0000-4000-8000-000000000001' and (completed_at is not null or completed_by is not null)) then raise exception 'FAIL reopen';end if;end $$;
-- Assignment to an uninvited race participant is rejected.
insert into events(id,club_id,name,starts_at,place,type,event_kind) values ('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Závod',now()+interval '2 days','Les','OCR','race');
do $$begin begin insert into event_tasks(club_id,event_id,title,assignee_id) values ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','Výbava','30000000-0000-4000-8000-000000000002');raise exception 'FAIL assignee not on roster';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;end $$;
insert into event_tasks(club_id,event_id,title) select '20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Fiktivní úkol '||n from generate_series(3,100)n;
do $$begin begin insert into event_tasks(club_id,event_id,title) values ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Nad limit');raise exception 'FAIL task limit';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;end $$;
-- Archive denies member access; cleanup of cancelled event's assignee must not block retention.
select public.archive_club_member('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');
update events set status='cancelled' where id='50000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin if exists(select 1 from public.my_event_tasks('20000000-0000-4000-8000-000000000001')) then raise exception 'FAIL archived tasks available';end if;begin perform public.complete_event_task('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',true);raise exception 'FAIL archived member completes';exception when insufficient_privilege then null;end;end $$;
reset role;
delete from members where id='30000000-0000-4000-8000-000000000001';
do $$begin if not exists(select 1 from event_tasks where id='60000000-0000-4000-8000-000000000001' and assignee_id is null) then raise exception 'FAIL cancelled assignee retention';end if;end $$;
set local role anon;
do $$begin begin perform public.my_event_tasks('20000000-0000-4000-8000-000000000001');raise exception 'FAIL anonymous tasks';exception when insufficient_privilege then null;end;end $$;
rollback;
