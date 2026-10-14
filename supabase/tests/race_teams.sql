begin;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into clubs(id,name) values ('20000000-0000-4000-8000-000000000001','Fiktivní týmy'),('20000000-0000-4000-8000-000000000002','Cizí klub');
insert into club_roles values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','coach'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member');
insert into members(id,club_id,name,kind) values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fiktivní první','member'),('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Fiktivní druhý','guest'),('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','Cizí','member');
insert into events(id,club_id,name,starts_at,place,type,event_kind) values ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fiktivní týmový závod',now()-interval '2 days','Park','OCR','race');
insert into participation(club_id,event_id,member_id,attended) select '20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',id,true from members where club_id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
insert into race_results(club_id,event_id,member_id,status,elapsed_ms) select club_id,event_id,member_id,'finished',120000 from participation;
select save_race_team('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','Fiktivní Alfa','Mix',array['30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002']::uuid[]);
do $$declare r integer;begin
 select revision into r from race_teams limit 1;
 begin update events set completed_at=now();raise exception 'FAIL incomplete team closed';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;end;
 begin perform set_race_team_result('20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',r,'finished',null,'');raise exception 'FAIL null time';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;end;
 perform set_race_team_result('20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',r,'finished',180000,'Fiktivní týmový čas');
 begin perform set_race_team_result('20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',r,'dnf',null,'');raise exception 'FAIL stale edit';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;end;
end $$;
update events set completed_at=now();
do $$begin if not exists(select 1 from events where completed_at is not null) then raise exception 'FAIL complete team';end if;end $$;
do $$begin
 begin perform save_race_team('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002','Fiktivní Beta','Mix',array['30000000-0000-4000-8000-000000000001']::uuid[]);raise exception 'FAIL duplicate member';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;end;
 begin perform save_race_team('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002','Cizí','Mix',array['30000000-0000-4000-8000-000000000003']::uuid[]);raise exception 'FAIL foreign roster';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;end;
 if (select count(*) from race_teams)<>1 or (select count(*) from race_team_members)<>2 then raise exception 'FAIL failed save changed roster';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 if exists(select 1 from race_teams) or exists(select 1 from race_team_members) then raise exception 'FAIL member read';end if;
 begin perform delete_race_team('20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',4);raise exception 'FAIL member delete';exception when insufficient_privilege then null;end;
 begin update race_teams set name='Forbidden';raise exception 'FAIL direct update';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$declare r integer;begin
 select revision into r from race_teams limit 1;
 perform save_race_team('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','Fiktivní Alfa','Mix',array['30000000-0000-4000-8000-000000000001']::uuid[],r);
 if not exists(select 1 from race_teams where status is null and elapsed_ms is null) or exists(select 1 from events where completed_at is not null) then raise exception 'FAIL roster did not invalidate';end if;
end $$;
-- The removed participant remains on the race roster with the individual result.
do $$begin if (select count(*) from participation)<>2 or (select count(*) from race_results)<>2 then raise exception 'FAIL team edit changed individual records';end if;end $$;
do $$declare r integer;begin select revision into r from race_teams limit 1;perform set_race_team_result('20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',r,'finished',190000,'');end $$;
update events set completed_at=now();
reset role;
delete from members where id='30000000-0000-4000-8000-000000000001';
do $$begin if not exists(select 1 from events where completed_at is not null) or not exists(select 1 from race_teams where status='finished' and elapsed_ms=190000) then raise exception 'FAIL retention reopened history';end if;end $$;
rollback;
