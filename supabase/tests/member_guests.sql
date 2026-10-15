begin;
insert into auth.users(id) select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,3)n;
insert into clubs(id,name) values('20000000-0000-4000-8000-000000000001','Klub');
insert into club_roles values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','coach'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','member');
insert into members(id,club_id,user_id,name,kind) select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001',('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Člen '||n,'member' from generate_series(2,3)n;
insert into events(id,club_id,name,starts_at,place,type,capacity) values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Trénink',now()+interval '2 days','Park','Běh',1),('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Jiný trénink',now()+interval '3 days','Park','Běh',null);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 begin perform invite_training_guest('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Host');raise exception 'FAIL guest without own RSVP';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
select respond_to_club_event('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','yes');
select set_config('test.guest',invite_training_guest('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Fiktivní host')::text,true);
do $$begin
 if invite_training_guest('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','  fiktivní HOST ')<>current_setting('test.guest')::uuid then raise exception 'FAIL duplicate guest';end if;
 if not exists(select 1 from my_training_guests('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001') where seat_status='waiting') then raise exception 'FAIL guest capacity';end if;
 if exists(select 1 from member_event_roster('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002') where member_id=current_setting('test.guest')::uuid) then raise exception 'FAIL guest in unrelated training';end if;
end $$;
reset role;
update members set removed_at=now() where id=current_setting('test.guest')::uuid;
set local role authenticated;
do $$begin
 begin perform invite_training_guest('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Fiktivní host');raise exception 'FAIL archived guest duplicated';exception when raise_exception then if SQLERRM<>'Guest archived' then raise;end if;end;
end $$;
reset role;
update members set removed_at=null where id=current_setting('test.guest')::uuid;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
do $$begin
 if exists(select 1 from my_training_guests('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001')) then raise exception 'FAIL other members guests';end if;
 begin perform withdraw_training_guest('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',current_setting('test.guest')::uuid);raise exception 'FAIL remove other guest';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
select respond_to_club_event('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','no');
do $$begin if exists(select 1 from my_training_guests('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001')) then raise exception 'FAIL sponsor cancellation leaves guests';end if;end $$;
select respond_to_club_event('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','yes');
select invite_training_guest('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Fiktivní host');
select withdraw_training_guest('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',current_setting('test.guest')::uuid);
select invite_training_guest('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Fiktivní host');
reset role;
do $$begin if (select count(*) from members where event_guest)<>1 then raise exception 'FAIL repeated guest creates duplicate member';end if;end $$;
update events set starts_at=now()-interval '2 hours' where id='50000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin
 begin perform invite_training_guest('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Pozdní host');raise exception 'FAIL closed training';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
select mark_training_present('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',array[current_setting('test.guest')::uuid]);
reset role;
update events set starts_at=now()-interval '2 hours',actual_notes='Hotový jiný trénink' where id='50000000-0000-4000-8000-000000000002';
set local role authenticated;
select mark_training_present('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002',array['30000000-0000-4000-8000-000000000002'::uuid,'30000000-0000-4000-8000-000000000003'::uuid]);
update events set completed_at=now() where id='50000000-0000-4000-8000-000000000002';
do $$begin
 if not exists(select 1 from events where id='50000000-0000-4000-8000-000000000002' and completed_at is not null) then raise exception 'FAIL unrelated guest blocks completion';end if;
 if exists(select 1 from participation where member_id=current_setting('test.guest')::uuid and event_id='50000000-0000-4000-8000-000000000002') then raise exception 'FAIL unrelated guest participation';end if;
end $$;

do $$begin if not exists(select 1 from participation where member_id=current_setting('test.guest')::uuid and attended=true) then raise exception 'FAIL coach guest attendance';end if;end $$;
rollback;
