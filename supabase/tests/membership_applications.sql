begin;
insert into auth.users(id,email,email_confirmed_at) select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'join'||n||'@example.invalid',case when n=5 then null else now() end from generate_series(1,7)n;
insert into clubs(id,name,applications_open) values('20000000-0000-4000-8000-000000000001','Pozvánkový klub',false),('20000000-0000-4000-8000-000000000002','Otevřený klub',true),('20000000-0000-4000-8000-000000000003','Neveřejný klub',false);
insert into club_roles values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','coach'),('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004','owner');
insert into members(id,club_id,name,kind) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Dřívější host','guest'),('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','Cizí záznam','guest');
insert into events(id,club_id,name,starts_at,place,type) values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Historický trénink',now()+interval '1 day','Park','Běh');
insert into participation(club_id,event_id,member_id,response) values('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','yes');
set local role anon;
do $$begin begin perform joinable_clubs();raise exception 'FAIL anonymous directory';exception when insufficient_privilege then null;end;end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$declare invite jsonb;begin
 begin perform set_club_admissions('20000000-0000-4000-8000-000000000001',true);raise exception 'FAIL coach directory toggle';exception when insufficient_privilege then null;end;
 invite:=issue_join_invitation('20000000-0000-4000-8000-000000000001','JOIN3@example.invalid');
 perform set_config('test.old_join_token',invite->>'token',true);
 invite:=issue_join_invitation('20000000-0000-4000-8000-000000000001','JOIN3@example.invalid');
 perform set_config('test.join_token',invite->>'token',true);perform set_config('test.join_id',invite->>'id',true);
 perform mark_join_invitation_sent((invite->>'id')::uuid);
 begin perform token_hash from club_join_invitations;raise exception 'FAIL token hash exposed';exception when insufficient_privilege then null;end;
 if (select count(*) from club_join_invitations where sent_at is not null)<>1 then raise exception 'FAIL sent status';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004"}',true);
do $$begin
 if exists(select 1 from joinable_clubs(current_setting('test.join_token')) where id='20000000-0000-4000-8000-000000000001') then raise exception 'FAIL wrong email private directory';end if;
 begin perform submit_club_application('20000000-0000-4000-8000-000000000001','Jiné','Jméno',current_setting('test.join_token'));raise exception 'FAIL wrong email invitation';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005"}',true);
do $$begin
 begin perform submit_club_application('20000000-0000-4000-8000-000000000002','Bez','Ověření');raise exception 'FAIL unverified applicant';exception when raise_exception then if sqlerrm='FAIL unverified applicant' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
do $$declare request uuid;begin
 if exists(select 1 from joinable_clubs(current_setting('test.old_join_token')) where id='20000000-0000-4000-8000-000000000001') then raise exception 'FAIL superseded invitation';end if;
 if (select count(*) from joinable_clubs())<>1 then raise exception 'FAIL opt-in directory';end if;
 if not exists(select 1 from joinable_clubs(current_setting('test.join_token')) where id='20000000-0000-4000-8000-000000000001' and invited) then raise exception 'FAIL invited private club';end if;
 begin perform submit_club_application('20000000-0000-4000-8000-000000000001','Jan','Novák');raise exception 'FAIL closed club admission';exception when insufficient_privilege then null;end;
 begin perform submit_club_application('20000000-0000-4000-8000-000000000002',' ','Novák');raise exception 'FAIL blank name';exception when raise_exception then if sqlerrm='FAIL blank name' then raise;end if;end;
 request:=submit_club_application('20000000-0000-4000-8000-000000000001',' Jan ',' Novák ',current_setting('test.join_token'));
 perform set_config('test.join_request',request::text,true);
 if submit_club_application('20000000-0000-4000-8000-000000000001','Jan','Novák',current_setting('test.join_token'))<>request then raise exception 'FAIL duplicate pending application';end if;
 if public.has_club_role('20000000-0000-4000-8000-000000000001',array['member']) then raise exception 'FAIL access before approval';end if;
 if exists(select 1 from events) then raise exception 'FAIL event access before approval';end if;
 if (select count(*) from my_club_applications() where status='pending')<>1 then raise exception 'FAIL own application status';end if;
 begin perform review_club_application(request,true);raise exception 'FAIL self approval';exception when insufficient_privilege then null;end;
 begin insert into club_join_requests(club_id,applicant_id,email,first_name,last_name) values('20000000-0000-4000-8000-000000000003',auth.uid(),'spoof@example.invalid','A','B');raise exception 'FAIL raw application write';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004"}',true);
do $$begin
 if exists(select 1 from club_join_requests) then raise exception 'FAIL foreign request PII';end if;
 begin perform review_club_application(current_setting('test.join_request')::uuid,true);raise exception 'FAIL foreign staff approval';exception when insufficient_privilege then null;end;
end $$;
reset role;
create function pg_temp.fail_join_role() returns trigger language plpgsql as $$begin if new.user_id='10000000-0000-4000-8000-000000000003' then raise exception 'Simulated role failure';end if;return new;end $$;
create trigger fail_join_role before insert on club_roles for each row execute function pg_temp.fail_join_role();
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 begin perform review_club_application(current_setting('test.join_request')::uuid,true,'30000000-0000-4000-8000-000000000001');raise exception 'FAIL failed approval succeeded';exception when raise_exception then if sqlerrm='FAIL failed approval succeeded' then raise;end if;end;
 if not exists(select 1 from members where id='30000000-0000-4000-8000-000000000001' and user_id is null and kind='guest' and name='Dřívější host') then raise exception 'FAIL partial member update';end if;
 if not exists(select 1 from club_join_requests where id=current_setting('test.join_request')::uuid and status='pending') then raise exception 'FAIL partial application approval';end if;
end $$;
reset role;
drop trigger fail_join_role on club_roles;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$declare linked uuid;begin
 begin perform review_club_application(current_setting('test.join_request')::uuid,true,'30000000-0000-4000-8000-000000000003');raise exception 'FAIL foreign member link';exception when raise_exception then if sqlerrm='FAIL foreign member link' then raise;end if;end;
 linked:=review_club_application(current_setting('test.join_request')::uuid,true,'30000000-0000-4000-8000-000000000001');
 if linked<>'30000000-0000-4000-8000-000000000001' then raise exception 'FAIL host identity preserved';end if;
 if review_club_application(current_setting('test.join_request')::uuid,true)<>linked then raise exception 'FAIL repeated approval';end if;
 if not exists(select 1 from members where id=linked and kind='member' and name='Jan Novák' and user_id='10000000-0000-4000-8000-000000000003') then raise exception 'FAIL applicant linked';end if;
 if (select count(*) from participation where member_id=linked)<>1 then raise exception 'FAIL history lost';end if;
 if (select role from club_roles where club_id='20000000-0000-4000-8000-000000000001' and user_id='10000000-0000-4000-8000-000000000003')<>'member' then raise exception 'FAIL wrong role';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
do $$begin
 if (select status from my_club_applications() where club_id='20000000-0000-4000-8000-000000000001')<>'approved' then raise exception 'FAIL approved status';end if;
 begin perform submit_club_application('20000000-0000-4000-8000-000000000001','Jan','Novák');raise exception 'FAIL duplicate active member';exception when raise_exception then if sqlerrm='FAIL duplicate active member' then raise;end if;end;
 perform set_config('test.public_request',submit_club_application('20000000-0000-4000-8000-000000000002','Jan','Novák')::text,true);
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
select review_club_application(current_setting('test.public_request')::uuid,false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
select set_config('test.public_request',submit_club_application('20000000-0000-4000-8000-000000000002','Jan','Novák')::text,true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
select review_club_application(current_setting('test.public_request')::uuid,true);
do $$begin
 if (select count(*) from members where club_id='20000000-0000-4000-8000-000000000002' and user_id='10000000-0000-4000-8000-000000000003')<>1 then raise exception 'FAIL new public member';end if;
 if (select count(*) from club_join_requests where club_id='20000000-0000-4000-8000-000000000002')<>2 then raise exception 'FAIL rejected history overwritten';end if;
end $$;
-- Restore an applicant's old member identity rather than duplicate it.
reset role;
insert into members(id,club_id,user_id,name,kind,removed_at,purge_after) values('30000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000006','Dřívější člen','member',now(),now()+interval '1 month');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000006"}',true);
select set_config('test.restore_request',submit_club_application('20000000-0000-4000-8000-000000000002','Eva','Nová')::text,true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$begin
 if review_club_application(current_setting('test.restore_request')::uuid,true)<>'30000000-0000-4000-8000-000000000006' then raise exception 'FAIL restored duplicate identity';end if;
 if exists(select 1 from members where id='30000000-0000-4000-8000-000000000006' and removed_at is not null) then raise exception 'FAIL member not restored';end if;
end $$;
rollback;
