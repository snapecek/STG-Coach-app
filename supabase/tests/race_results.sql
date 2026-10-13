begin;
insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000001','coach@example.invalid'),('10000000-0000-4000-8000-000000000002','member@example.invalid');
insert into public.clubs(id,name) values ('20000000-0000-4000-8000-000000000001','Fiktivní klub'),('20000000-0000-4000-8000-000000000002','Cizí klub');
insert into public.club_roles values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','coach'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member');
insert into public.members(id,club_id,name,kind) values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fiktivní běžec','member'),('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Cizí běžec','guest');
insert into public.events(id,club_id,name,starts_at,place,type,event_kind,actual_notes) values ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fiktivní závod',now()-interval '2 days','Park','Běh','race','Fiktivní průběh');
insert into public.participation(club_id,event_id,member_id,attended) values ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into public.race_results values ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','finished',321500,'Fiktivní výsledek');
update public.events set completed_at=now();
update public.race_results set elapsed_ms=322000;
do $$begin
 if exists(select 1 from public.events where completed_at is not null) then raise exception 'FAIL result update did not reopen';end if;
 begin update public.race_results set elapsed_ms=null;raise exception 'FAIL null finisher time';exception when check_violation then null;end;
 begin update public.race_results set status='dns';raise exception 'FAIL DNS with time';exception when check_violation then null;end;
 begin update public.events set event_kind='training';raise exception 'FAIL changed race with results';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
 begin insert into public.race_results values ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','dns',null,'');raise exception 'FAIL foreign member';exception when insufficient_privilege or foreign_key_violation then null;end;
end $$;
update public.events set status='cancelled';
do $$begin
 begin update public.race_results set elapsed_ms=323000;raise exception 'FAIL cancelled result update';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
update public.events set status='scheduled';
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.race_results) then raise exception 'FAIL member sees results';end if;
 begin insert into public.race_results values ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','dns',null,'');raise exception 'FAIL member writes results';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$begin if exists(select 1 from public.race_results) then raise exception 'FAIL outsider sees results';end if;end $$;
set local role anon;
do $$begin begin perform 1 from public.race_results;raise exception 'FAIL anon reads';exception when insufficient_privilege then null;end;end $$;
reset role;
delete from public.events;
do $$begin if exists(select 1 from public.race_results) then raise exception 'FAIL cascade';end if;end $$;
rollback;
