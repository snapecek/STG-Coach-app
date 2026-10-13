-- Run only in a disposable/development Supabase project after the migration.
-- Failures are assertions; on error issue ROLLBACK before continuing.
begin;
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','stg-coach-a@example.invalid'),
 ('10000000-0000-4000-8000-000000000002','stg-coach-b@example.invalid'),
 ('10000000-0000-4000-8000-000000000003','stg-member-a@example.invalid');
insert into public.clubs(id,name) values
 ('20000000-0000-4000-8000-000000000001','Fiktivní klub A'),
 ('20000000-0000-4000-8000-000000000002','Fiktivní klub B');
insert into public.club_roles(club_id,user_id,role) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','coach'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','owner'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','member');
insert into public.members(id,club_id,name,kind) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fiktivní člen A','member'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Fiktivní host B','guest');
insert into public.templates(id,club_id,name,type,place,minutes,plan) values
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fiktivní A','Běh','Park A',45,'Plán A'),
 ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Fiktivní B','Běh','Park B',45,'Plán B');
insert into public.events(id,club_id,template_id,name,starts_at,place,type) values
 ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Událost A','2026-11-18T17:00:00Z','Park A','Běh'),
 ('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','Událost B','2026-11-18T17:00:00Z','Park B','Běh');
insert into public.participation(club_id,event_id,member_id,response,attended) values
 ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','yes',true),
 ('20000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','yes',true);
set local role anon;
do $$begin
 begin perform * from public.members; raise exception 'FAIL: anonymous member read allowed';
 exception when insufficient_privilege then null; end;
end$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$begin
 if (select count(*) from public.templates)!=1 then raise exception 'FAIL: template isolation'; end if;
 if (select count(*) from public.events)!=1 then raise exception 'FAIL: event isolation'; end if;
 if (select count(*) from public.participation)!=1 then raise exception 'FAIL: attendance isolation'; end if;
 begin
 insert into public.events(club_id,template_id,name,starts_at,place,type)
 values('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','Blocked',now(),'Test','Běh');
 raise exception 'FAIL: foreign template link allowed';
 exception when foreign_key_violation then null; end;
 begin
 insert into public.participation(club_id,event_id,member_id)
 values('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002');
 raise exception 'FAIL: foreign member attendance link allowed';
 exception when foreign_key_violation then null; end;
 if (select count(*) from public.clubs)!=1 then raise exception 'FAIL: coach club isolation'; end if;
 if (select count(*) from public.members)!=1 then raise exception 'FAIL: coach member isolation'; end if;
 if exists(select 1 from public.members where club_id='20000000-0000-4000-8000-000000000002') then raise exception 'FAIL: foreign members visible'; end if;
 begin
 insert into public.members(club_id,name,kind) values('20000000-0000-4000-8000-000000000002','Blocked','guest');
 raise exception 'FAIL: foreign member insert allowed';
 exception when insufficient_privilege then null; end;
 begin
 insert into public.club_roles(club_id,user_id,role) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','owner');
 raise exception 'FAIL: coach privilege escalation allowed';
 exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$begin
 if (select count(*) from public.events)!=1 then raise exception 'FAIL: member event read'; end if;
 if (select count(*) from public.participation)!=0 then raise exception 'FAIL: member attendance exposed'; end if;
 begin
 update public.participation set attended=false;
 if found then raise exception 'FAIL: member changed attendance'; end if;
 end;
 begin
 insert into public.participation(club_id,event_id,member_id,attended)
 values('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',true);
 raise exception 'FAIL: member self-confirmed attendance';
 exception when insufficient_privilege then null; end;
 if (select count(*) from public.members)!=0 then raise exception 'FAIL: member registry exposed'; end if;
 begin
 insert into public.members(club_id,name,kind) values('20000000-0000-4000-8000-000000000001','Blocked','member');
 raise exception 'FAIL: member registry write allowed';
 exception when insufficient_privilege then null; end;
end$$;
reset role;
rollback;
