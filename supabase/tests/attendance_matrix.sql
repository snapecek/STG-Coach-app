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
update participation set attendance_excused=true;
do $$begin if not exists(select 1 from participation where attendance_excused and attended=false) then raise exception 'FAIL excused';end if;end $$;
select public.mark_training_present('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',array['30000000-0000-4000-8000-000000000001']::uuid[]);
do $$begin if not exists(select 1 from participation where attendance_excused and attended=false) then raise exception 'FAIL bulk overwrote excuse';end if;end $$;
update participation set attended=null,attendance_excused=false;
select public.mark_training_present('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',array['30000000-0000-4000-8000-000000000001']::uuid[]);
do $$begin if not exists(select 1 from participation where attended and not attendance_excused) then raise exception 'FAIL mark present';end if;end $$;
-- The browser saves a complete attendance review with one upsert statement.
insert into members(id,club_id,name,kind) values
 ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','Fiktivní omluvený host','guest'),
 ('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','Fiktivní bez odpovědi','member');
update participation set response='yes';
do $$declare previous_order bigint;begin
 select reservation_order into previous_order from participation where member_id='30000000-0000-4000-8000-000000000001';
 insert into participation(club_id,event_id,member_id,attended,attendance_excused,confirmed_by) values
 ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',true,false,auth.uid()),
 ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003',false,true,auth.uid()),
 ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004',false,false,auth.uid())
 on conflict(event_id,member_id) do update set attended=excluded.attended,attendance_excused=excluded.attendance_excused,confirmed_by=excluded.confirmed_by;
 if not exists(select 1 from participation where response='yes' and attended and reservation_order=previous_order and member_id='30000000-0000-4000-8000-000000000001') then raise exception 'FAIL batch changed RSVP or reservation';end if;
 if not exists(select 1 from participation where member_id='30000000-0000-4000-8000-000000000003' and attendance_excused and attended=false and confirmed_by=auth.uid()) then raise exception 'FAIL batch excuse';end if;
 if not exists(select 1 from participation where member_id='30000000-0000-4000-8000-000000000004' and response is null and attended=false and not attendance_excused and confirmed_by=auth.uid()) then raise exception 'FAIL batch unanswered verification';end if;
 begin
  insert into participation(club_id,event_id,member_id,attended,confirmed_by) values
  ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',false,auth.uid()),
  ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000099',true,auth.uid())
  on conflict(event_id,member_id) do update set attended=excluded.attended,confirmed_by=excluded.confirmed_by;
  raise exception 'FAIL invalid batch accepted';
 exception when foreign_key_violation or insufficient_privilege then null;end;
 if not exists(select 1 from participation where member_id='30000000-0000-4000-8000-000000000001' and attended=true) then raise exception 'FAIL batch partially saved';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 begin perform public.mark_training_present('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',array['30000000-0000-4000-8000-000000000001']::uuid[]);raise exception 'FAIL member bulk';exception when insufficient_privilege then null;end;
 begin perform public.mark_training_present('20000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001',array['30000000-0000-4000-8000-000000000001']::uuid[]);raise exception 'FAIL other club';exception when insufficient_privilege then null;end;
end $$;
rollback;
