begin;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into clubs(id,name) values ('20000000-0000-4000-8000-000000000001','Fiktivní deník'),('20000000-0000-4000-8000-000000000002','Cizí klub');
insert into club_roles values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','coach'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member');
insert into members(id,club_id,name,kind) values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fiktivní člen','member');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
insert into events(id,club_id,name,place,type,plan,starts_at,duration_minutes,event_kind,actual_notes,actual_distance_km) values ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fiktivní běh','Park','Běh','Plán',now()-interval '2 days',60,'training','Skutečný průběh',11.2);
insert into participation(club_id,event_id,member_id,attended) values ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',true);
update events set completed_at=now() where id='50000000-0000-4000-8000-000000000001';
do $$begin if not exists(select 1 from events where completed_at is not null) then raise exception 'FAIL completion';end if;end $$;
update events set actual_distance_km=12.345 where id='50000000-0000-4000-8000-000000000001';
do $$begin
 if not exists(select 1 from events where actual_distance_km=12.345 and completed_at is null and completed_by is null) then raise exception 'FAIL distance update/reopen';end if;
 begin update events set actual_distance_km=-1;raise exception 'FAIL negative';exception when check_violation then null;end;
 begin update events set actual_distance_km=10001;raise exception 'FAIL too large';exception when check_violation then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
update events set actual_distance_km=99;
reset role;
do $$begin if (select actual_distance_km from events where id='50000000-0000-4000-8000-000000000001')<>12.345 then raise exception 'FAIL member changed distance';end if;end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
update events set event_kind='race' where id='50000000-0000-4000-8000-000000000001';
do $$begin
 if exists(select 1 from events where actual_distance_km is not null) then raise exception 'FAIL training distance retained on race';end if;
 begin update events set actual_distance_km=4;raise exception 'FAIL race distance accepted';exception when check_violation then null;end;
end $$;
rollback;
