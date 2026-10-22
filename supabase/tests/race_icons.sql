-- Disposable DB only; icon snapshots, validation, series and RLS.
begin;
insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000001','owner@example.invalid'),('10000000-0000-4000-8000-000000000002','member@example.invalid');
insert into public.clubs(id,name) values('20000000-0000-4000-8000-000000000001','Fiktivní klub');
insert into public.club_roles(club_id,user_id,role) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member');
insert into public.members(id,club_id,user_id,name,kind) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Fiktivní člen','member');
insert into public.templates(id,club_id,name,type,place,minutes,plan,training_icon) values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Šablona','Kondice','Park',60,'Původní plán','swimming');
insert into public.events(id,club_id,template_id,name,starts_at,type,place,plan) values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Trénink',now()-interval '2 days','Kondice','Park','Původní plán');


set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$declare r public.events;begin
 if not public.race_icons_ready() then raise exception 'FAIL readiness';end if;
 r:=public.create_club_race('20000000-0000-4000-8000-000000000001','{"id":"50000000-0000-4000-8000-000000000002","name":"Fiktivní závod","place":"Park","type":"OCR","starts_at":"2026-12-01T18:00:00Z","duration_minutes":180,"training_icon":"stopwatch"}'::jsonb,array['30000000-0000-4000-8000-000000000001']::uuid[]);
 if r.training_icon is distinct from 'stopwatch' then raise exception 'FAIL race icon discarded';end if;
 if (select count(*) from public.participation where event_id=r.id)<>1 then raise exception 'FAIL race roster';end if;
end $$;
update public.events set place='Les' where id='50000000-0000-4000-8000-000000000002';
do $$begin
 if (select training_icon from public.events where id='50000000-0000-4000-8000-000000000002') is distinct from 'stopwatch' then raise exception 'FAIL unrelated update discarded icon';end if;
 begin
  update public.events set training_icon='invalid' where id='50000000-0000-4000-8000-000000000002';raise exception 'FAIL invalid race icon accepted';
 exception when check_violation then null;end;
end $$;
update public.events set training_icon='cycling' where id='50000000-0000-4000-8000-000000000002';
do $$declare r public.events;begin
 select * into r from public.events where id='50000000-0000-4000-8000-000000000002';
 r:=public.create_club_race(r.club_id,to_jsonb(r)||'{"id":"50000000-0000-4000-8000-000000000003","name":"Kopie závodu"}'::jsonb,array[]::uuid[]);
 if r.training_icon is distinct from 'cycling' then raise exception 'FAIL copied race icon';end if;
end $$;
update public.events set training_icon='none' where id='50000000-0000-4000-8000-000000000002';
do $$begin
 if (select training_icon from public.events where id='50000000-0000-4000-8000-000000000002') is distinct from 'none' then raise exception 'FAIL disabled watermark';end if;
end $$;
update public.events set training_icon=null where id='50000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$declare n integer;begin
 update public.events set training_icon='stopwatch' where event_kind='race';get diagnostics n=row_count;
 if n<>0 then raise exception 'FAIL member changed race icon';end if;
 begin
  perform public.create_club_race('20000000-0000-4000-8000-000000000001','{}'::jsonb,array[]::uuid[]);raise exception 'FAIL member created race';
 exception when insufficient_privilege then null;end;
end $$;
rollback;
