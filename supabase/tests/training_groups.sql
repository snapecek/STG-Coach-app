begin;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into public.clubs(id,name) values ('20000000-0000-4000-8000-000000000001','Fiktivní skupiny'),('20000000-0000-4000-8000-000000000002','Cizí klub');
insert into public.club_roles values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','coach'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member');
insert into public.members(id,club_id,name,kind,user_id) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fiktivní sportovec','member','10000000-0000-4000-8000-000000000002'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Fiktivní host','guest',null),
 ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','Člen mimo skupinu','member',null),
 ('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000002','Cizí člen','member',null);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
select public.save_training_group('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Fiktivní začátečníci','Kondiční skupina',array['30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002']::uuid[]);
select * from public.create_group_trainings('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_build_object('id','50000000-0000-4000-8000-000000000001','name','Skupinový trénink','place','Park','type','Kondice','starts_at',now()+interval '1 day','duration_minutes',60,'capacity',1),jsonb_build_object('id','50000000-0000-4000-8000-000000000002','name','Opakovaný trénink','place','Park','type','Kondice','starts_at',now()+interval '8 days','duration_minutes',60)));
do $$begin
 if (select count(*) from public.participation)<>4 then raise exception 'FAIL snapshot roster';end if;
 begin perform public.save_training_group('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Neplatné','',array['30000000-0000-4000-8000-000000000004']::uuid[]);raise exception 'FAIL cross-club member';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
 if (select count(*) from public.training_group_members)<>2 then raise exception 'FAIL failed save altered group';end if;
 begin perform public.save_training_group('20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','Cizí','',array[]::uuid[]);raise exception 'FAIL other-club write';exception when insufficient_privilege then null;end;
 begin perform public.create_group_trainings('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_build_object('id','50000000-0000-4000-8000-000000000099','name','Validní první','place','Park','type','Běh','starts_at',now()+interval '1 day','duration_minutes',60),jsonb_build_object('id','50000000-0000-4000-8000-000000000098','name','Neplatný druhý','place','Park','type','Běh','starts_at',now()+interval '8 days','duration_minutes',999)));raise exception 'FAIL invalid series';exception when check_violation then null;end;
 if exists(select 1 from public.events where id='50000000-0000-4000-8000-000000000099') then raise exception 'FAIL partial series created';end if;
end $$;
-- Explicit roster removal affects one term only and revokes its member access.
delete from public.participation where event_id='50000000-0000-4000-8000-000000000002' and member_id='30000000-0000-4000-8000-000000000001';
-- Empty groups can be saved but cannot create an event with no audience.
select public.save_training_group('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','Prázdná skupina','',array[]::uuid[]);
do $$begin begin perform public.create_group_trainings('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',jsonb_build_array(jsonb_build_object('name','Prázdný trénink')));raise exception 'FAIL empty roster event';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;end $$;
-- Renaming/replacing members affects only future creation, not scheduled roster/history.
select public.save_training_group('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Fiktivní pokročilí','',array['30000000-0000-4000-8000-000000000003']::uuid[]);
select * from public.create_group_trainings('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_build_object('id','50000000-0000-4000-8000-000000000003','name','Jiná soupiska','place','Park','type','Běh','starts_at',now()+interval '2 days','duration_minutes',60)));
do $$begin
 if not exists(select 1 from public.events where id='50000000-0000-4000-8000-000000000001' and group_name='Fiktivní začátečníci') or (select count(*) from public.participation where event_id='50000000-0000-4000-8000-000000000001')<>2 then raise exception 'FAIL historical group changed';end if;
 begin update public.events set roster_only=false where id='50000000-0000-4000-8000-000000000001';raise exception 'FAIL audience switch';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
 begin update public.events set event_kind='race',capacity=null where id='50000000-0000-4000-8000-000000000001';raise exception 'FAIL group becomes race';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
select public.archive_training_group('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001');
do $$begin
 begin perform public.create_group_trainings('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','[]');raise exception 'FAIL archived group planning';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 if exists(select 1 from public.training_groups) or exists(select 1 from public.training_group_members) then raise exception 'FAIL member sees registry';end if;
 if not exists(select 1 from public.events where id='50000000-0000-4000-8000-000000000001') or exists(select 1 from public.events where id in ('50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003')) then raise exception 'FAIL member event privacy';end if;
 begin perform public.respond_to_club_event('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003','yes');raise exception 'FAIL member joins another roster';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
 begin perform public.save_training_group('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Změna','',array[]::uuid[]);raise exception 'FAIL member manages group';exception when insufficient_privilege then null;end;
end $$;
select public.respond_to_club_event('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','yes');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
-- Completion only needs the selected participants, even though another active club member exists.
update public.events set starts_at=now()-interval '2 days',actual_notes='Fiktivní skutečný průběh' where id='50000000-0000-4000-8000-000000000001';
do $$begin begin update public.events set completed_at=now() where id='50000000-0000-4000-8000-000000000001';raise exception 'FAIL completion without selected attendance';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;end $$;
update public.participation set attended=false,confirmed_by='10000000-0000-4000-8000-000000000001' where event_id='50000000-0000-4000-8000-000000000001';
update public.events set completed_at=now() where id='50000000-0000-4000-8000-000000000001';
do $$begin if not exists(select 1 from public.events where id='50000000-0000-4000-8000-000000000001' and completed_at is not null) then raise exception 'FAIL selected completion';end if;end $$;
select public.archive_training_group('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',true);
set local role anon;
do $$begin begin perform public.can_read_club_event('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001');raise exception 'FAIL anon reads event';exception when insufficient_privilege then null;end;end $$;
rollback;
