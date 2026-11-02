-- Completion is explicit, scoped, and never creates attendance or results.
begin;
insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000001','owner@example.invalid'),('10000000-0000-4000-8000-000000000002','member@example.invalid');
insert into clubs(id,name) values ('20000000-0000-4000-8000-000000000001','Test'),('20000000-0000-4000-8000-000000000002','Other');
insert into club_roles values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member');
insert into members(id,club_id,name,kind) values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Test member','member');
insert into events(id,club_id,name,place,type,event_kind,starts_at) select ('50000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001','Incomplete','Park','Běh',case when n=2 then 'race' else 'training' end,case when n=3 then now()+interval '1 day' else now()-interval '2 days' end from generate_series(1,5)n;
update events set status='cancelled' where id='50000000-0000-4000-8000-000000000004';
insert into participation(club_id,event_id,member_id,response) values ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','yes');
insert into race_teams(id,club_id,event_id,name) values ('80000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','Incomplete team');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 begin perform complete_event_without_data('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001');raise exception 'FAIL member completed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$declare e events;begin
 begin perform complete_event_without_data('20000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001');raise exception 'FAIL cross club';exception when insufficient_privilege then null;end;
 begin update events set completed_at=now() where id='50000000-0000-4000-8000-000000000001';raise exception 'FAIL normal completion bypassed';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;end;
 e:=complete_event_without_data('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001');
 if e.completed_at is null or e.completed_by<>auth.uid() or e.actual_notes<>'' then raise exception 'FAIL training completion';end if;
 e:=complete_event_without_data('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002');
 if e.completed_at is null or (select attended from participation where event_id=e.id) is not null or exists(select 1 from race_results where event_id=e.id) or exists(select 1 from race_teams where event_id=e.id and status is not null) then raise exception 'FAIL fabricated race data';end if;
 if coalesce(current_setting('app.complete_without_data',true),'')<>'' then raise exception 'FAIL bypass leaked';end if;
 begin update events set completed_at=now() where id='50000000-0000-4000-8000-000000000005';raise exception 'FAIL later normal completion bypassed';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;end;
 begin perform complete_event_without_data('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003');raise exception 'FAIL future event';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;end;
 begin perform complete_event_without_data('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000004');raise exception 'FAIL cancelled event';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;end;
end $$;
update events set actual_notes='Later edit' where id='50000000-0000-4000-8000-000000000001';
do $$begin if exists(select 1 from events where id='50000000-0000-4000-8000-000000000001' and completed_at is not null) then raise exception 'FAIL edit did not reopen';end if;end $$;
reset role;
update clubs set archived_at=now() where id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin begin perform complete_event_without_data('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000005');raise exception 'FAIL archived club';exception when insufficient_privilege then null;end;end $$;
reset role;
set local role anon;
do $$begin begin perform complete_event_without_data('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000005');raise exception 'FAIL anonymous completion';exception when insufficient_privilege then null;end;end $$;
rollback;
