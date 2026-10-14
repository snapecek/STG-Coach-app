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
insert into training_performances(club_id,event_id,member_id,distance_m,planned_repetitions,interval_ms) values('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',800,6,array[192000,199000]);
do $$begin
 if not exists(select 1 from events where completed_at is null) then raise exception 'FAIL reopen';end if;
 begin update training_performances set interval_ms=array[0];raise exception 'FAIL zero time';exception when check_violation then null;end;
 begin update training_performances set interval_ms=array[null::integer];raise exception 'FAIL null time';exception when check_violation then null;end;
 begin update training_performances set planned_repetitions=1;raise exception 'FAIL too many repetitions';exception when check_violation then null;end;
 begin update training_performances set club_id='20000000-0000-4000-8000-000000000002';raise exception 'FAIL identity changed';exception when insufficient_privilege then null;when raise_exception then if sqlerrm='FAIL identity changed' then raise;end if;end;
end $$;
do $$begin
 begin update events set event_kind='race';raise exception 'FAIL converted measured training';exception when raise_exception then if sqlerrm='FAIL converted measured training' then raise;end if;end;
end $$;
update participation set attended=false;
do $$begin
 begin update training_performances set notes='invalid';raise exception 'FAIL absent measurement';exception when raise_exception then if sqlerrm='FAIL absent measurement' then raise;end if;end;
end $$;
update participation set attended=true;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin if exists(select 1 from training_performances) then raise exception 'FAIL member read';end if;end $$;
update training_performances set distance_m=100;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$begin if not exists(select 1 from training_performances where distance_m=800) then raise exception 'FAIL member write';end if;end $$;
delete from participation where event_id='50000000-0000-4000-8000-000000000001';
do $$begin if exists(select 1 from training_performances) then raise exception 'FAIL roster cascade';end if;end $$;
rollback;
