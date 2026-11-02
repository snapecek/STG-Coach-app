-- Real database behavior: guests, attendance separation, role edits and atomicity.
begin;
insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000001','owner@example.invalid'),('10000000-0000-4000-8000-000000000002','member@example.invalid');
insert into public.clubs(id,name) values('20000000-0000-4000-8000-000000000001','Race tools'),('20000000-0000-4000-8000-000000000002','Other club');
insert into public.club_roles(club_id,user_id,role) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$declare c uuid:='20000000-0000-4000-8000-000000000001';e public.events;g uuid;n int;other uuid;i text;begin
 if not public.race_icons_ready() or not public.special_sport_icons_ready() or not public.race_tools_ready() then raise exception 'FAIL repaired helpers';end if;
 -- Every current choice must survive the repaired create function and trigger.
 foreach i in array array['running','stopwatch','swimming','dumbbell','wrestling','bench-press','cycling','tennis','football','hurdle-jump','track','martial-arts','skipping','road-cycling','rowing','rugby','water-polo','table-tennis','hiking','equestrian','ocr','trail','triathlon','run-workout','hiit','kettlebell','none'] loop
  e:=public.create_club_race(c,jsonb_build_object('id',gen_random_uuid(),'name','Icon race','place','Park','type','OCR','starts_at',now()-interval '2 days','duration_minutes',60,'training_icon',i),array[]::uuid[]);
  if e.training_icon is distinct from i then raise exception 'FAIL icon discarded: %',i;end if;
 end loop;
 e:=public.create_club_race(c,jsonb_build_object('id',gen_random_uuid(),'name','Race with guests','place','Park','type','OCR','starts_at',now()-interval '2 days','duration_minutes',60,'training_icon','trail','guests','[{"name":"  Jana   Hostová ","role":"companion"},{"name":"Petr Host","role":"yes"}]'::jsonb),array[]::uuid[]);
 select m.id into g from public.members m join public.participation p on p.member_id=m.id where p.event_id=e.id and m.name='Jana Hostová';
 if g is null or (select count(*) from public.participation where event_id=e.id)<>2 then raise exception 'FAIL atomic draft guests';end if;
 if exists(select 1 from public.participation where event_id=e.id and (attended is not null or confirmed_by is not null)) then raise exception 'FAIL guest attendance auto-confirmed';end if;
 if not exists(select 1 from public.members where id=g and kind='guest' and event_guest and user_id is null) then raise exception 'FAIL reusable guest';end if;
 update public.participation set attended=true,confirmed_by=auth.uid() where member_id=g and event_id=e.id;
 update public.participation set response='yes' where member_id=g and event_id=e.id;
 if not exists(select 1 from public.participation where member_id=g and event_id=e.id and response='yes' and attended is true and confirmed_by=auth.uid()) then raise exception 'FAIL role lost attendance';end if;
 update public.participation set response='companion' where member_id=g and event_id=e.id;
 -- Retries must neither create a duplicate nor reset an existing response/attendance.
 if public.add_race_guest(c,e.id,'jana hostová','yes')<>g then raise exception 'FAIL retry identity';end if;
 if not exists(select 1 from public.participation where member_id=g and event_id=e.id and response='companion' and attended is true) then raise exception 'FAIL retry changed participation';end if;
 other:=public.add_race_guest(c,e.id,'Další host','yes');
 if not exists(select 1 from public.participation where event_id=e.id and member_id=other and response='yes' and attended is null) then raise exception 'FAIL detail guest';end if;
 insert into public.race_results(club_id,event_id,member_id,status,elapsed_ms,notes) values(c,e.id,other,'finished',10000,'');
 begin update public.participation set response='companion' where event_id=e.id and member_id=other;raise exception 'FAIL result role allowed';exception when raise_exception then if sqlerrm<>'Nejprve odeberte závodní výsledek a zařazení do týmu.' then raise;end if;end;
 select count(*) into n from public.members where club_id=c;
 begin
  perform public.create_club_race(c,jsonb_build_object('id','50000000-0000-4000-8000-000000000077','name','Invalid draft race','place','Park','type','OCR','starts_at',now(),'duration_minutes',60,'guests','[{"name":"Rolled back guest","role":"yes"},{"name":"Bad guest","role":"invalid"}]'::jsonb),array[]::uuid[]);
  raise exception 'FAIL invalid guest accepted';
 exception when raise_exception then if sqlerrm<>'Invalid guest role' then raise;end if;end;
 if (select count(*) from public.members where club_id=c)<>n or exists(select 1 from public.events where id='50000000-0000-4000-8000-000000000077') then raise exception 'FAIL partial race/guest persisted';end if;
 begin perform public.add_race_guest('20000000-0000-4000-8000-000000000002',e.id,'Foreign guest','yes');raise exception 'FAIL cross-club guest';exception when insufficient_privilege then null;end;
 update public.events set status='cancelled' where id=e.id;
 begin perform public.add_race_guest(c,e.id,'Cancelled race guest','yes');raise exception 'FAIL cancelled race guest';exception when raise_exception then if sqlerrm<>'Race unavailable' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 begin perform public.add_race_guest('20000000-0000-4000-8000-000000000001',gen_random_uuid(),'Forbidden guest','yes');raise exception 'FAIL member added guest';exception when insufficient_privilege then null;end;
end $$;
rollback;
