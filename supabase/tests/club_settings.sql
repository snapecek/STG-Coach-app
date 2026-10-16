begin;
insert into auth.users(id) select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,6)n;
insert into clubs(id,name) values('20000000-0000-4000-8000-000000000001','Klub'),('20000000-0000-4000-8000-000000000002','Cizí');
insert into club_roles values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','coach'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','member'),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','member'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','member');
insert into members(id,club_id,user_id,name,kind) values('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','Člen','member'),('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','Cizí člen','member'),('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','Archivovaný','member'),('30000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000001',null,'Bez účtu','member');
update members set removed_at=now() where id='30000000-0000-4000-8000-000000000005';
insert into events(id,club_id,name,starts_at,place,type) values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Trénink',now()+interval '2 days','Park','Běh');
insert into participation(club_id,event_id,member_id,response) values('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','yes');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
do $$begin
 if (select name from get_club_profile('20000000-0000-4000-8000-000000000001'))<>'Klub' then raise exception 'FAIL member branding';end if;
 begin perform club_settings_people('20000000-0000-4000-8000-000000000001');raise exception 'FAIL member staff access';exception when insufficient_privilege then null;end;
 begin perform set_club_logo('20000000-0000-4000-8000-000000000001');raise exception 'FAIL member logo';exception when insufficient_privilege then null;end;
 begin perform add_club_coach('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003');raise exception 'FAIL self promotion';exception when insufficient_privilege then null;end;
 begin perform create_managed_club('Nepovolený');raise exception 'FAIL member club creation';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 if (select count(*) from club_settings_people('20000000-0000-4000-8000-000000000001'))<>3 then raise exception 'FAIL candidate filtering';end if;
 begin perform get_club_profile('20000000-0000-4000-8000-000000000002');raise exception 'FAIL foreign branding';exception when insufficient_privilege then null;end;
 begin perform add_club_coach('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000004');raise exception 'FAIL cross club promotion';exception when insufficient_privilege then null;end;
 begin perform add_club_coach('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000005');raise exception 'FAIL archived promotion';exception when raise_exception then if sqlerrm='FAIL archived promotion' then raise;end if;end;
 begin perform add_club_coach('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000006');raise exception 'FAIL unlinked promotion';exception when raise_exception then if sqlerrm='FAIL unlinked promotion' then raise;end if;end;
end $$;
insert into storage.objects(bucket_id,name) values('club-logos','20000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000001.webp');
select set_club_logo('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000001.webp');
delete from storage.objects where bucket_id='club-logos';
do $$begin if (select count(*) from storage.objects where bucket_id='club-logos')<>1 then raise exception 'FAIL active logo removed';end if;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004"}',true);
do $$begin
 if exists(select 1 from storage.objects where bucket_id='club-logos') then raise exception 'FAIL foreign logo read';end if;
 begin insert into storage.objects(bucket_id,name) values('club-logos','20000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000002.webp');raise exception 'FAIL foreign upload';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
do $$begin if (select count(*) from storage.objects where bucket_id='club-logos')<>1 then raise exception 'FAIL member logo read';end if;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
select set_club_logo('20000000-0000-4000-8000-000000000001',null);
delete from storage.objects where bucket_id='club-logos';
select add_club_coach('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003');
select add_club_coach('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003');
do $$begin
 if not exists(select 1 from club_roles where user_id='10000000-0000-4000-8000-000000000003' and role='coach') then raise exception 'FAIL trainer role';end if;
 if not exists(select 1 from participation where member_id='30000000-0000-4000-8000-000000000003' and response='yes') then raise exception 'FAIL lost participation';end if;
end $$;
select set_config('test.newclub',(select id::text from create_managed_club(' Nový klub ')),true);
do $$begin
 if not exists(select 1 from club_roles where club_id=current_setting('test.newclub')::uuid and user_id=auth.uid() and role='owner') then raise exception 'FAIL missing new owner';end if;
 if exists(select 1 from events where club_id=current_setting('test.newclub')::uuid) or exists(select 1 from members where club_id=current_setting('test.newclub')::uuid) then raise exception 'FAIL seeded/copied new data';end if;
 if (select count(*) from events where club_id='20000000-0000-4000-8000-000000000001')<>1 then raise exception 'FAIL changed old club';end if;
end $$;
rollback;
