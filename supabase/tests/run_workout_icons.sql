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
update public.templates set training_icon='run-workout';
select count(*) from public.create_training_series('20000000-0000-4000-8000-000000000001','[{"id":"50000000-0000-4000-8000-000000000002","template_id":"40000000-0000-4000-8000-000000000001","name":"Běh a cvičení","type":"Běh a cvičení","place":"Park","starts_at":"2027-01-01T18:00:00Z","duration_minutes":60}]'::jsonb);
do $$declare r public.events;begin
 if not public.run_workout_icons_ready() then raise exception 'FAIL capability';end if;
 if (select training_icon from public.events where id='50000000-0000-4000-8000-000000000002') is distinct from 'run-workout' then raise exception 'FAIL run-workout snapshot';end if;
 r:=public.create_club_race('20000000-0000-4000-8000-000000000001','{"id":"50000000-0000-4000-8000-000000000003","name":"Běh a shyby","place":"Park","type":"Běh a cvičení","starts_at":"2027-01-01T18:00:00Z","duration_minutes":180,"training_icon":"run-workout"}'::jsonb,array[]::uuid[]);
 if r.training_icon is distinct from 'run-workout' then raise exception 'FAIL race run-workout';end if;
 begin update public.templates set training_icon='medal';raise exception 'FAIL retired template choice accepted';exception when check_violation then null;end;
 begin update public.events set training_icon='podium';raise exception 'FAIL retired event choice accepted';exception when check_violation then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 begin perform public.create_training_series('20000000-0000-4000-8000-000000000001','[]'::jsonb);raise exception 'FAIL member created series';exception when insufficient_privilege then null;end;
end $$;
rollback;
