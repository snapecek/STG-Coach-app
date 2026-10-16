begin;
insert into auth.users(id) select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,4)n;
insert into clubs(id,name) values('20000000-0000-4000-8000-000000000001','Klub'),('20000000-0000-4000-8000-000000000002','Cizí');
insert into club_roles values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','coach'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','member'),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','owner');
insert into members(id,club_id,user_id,name,kind) values('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Trenér','member'),('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','Člen','member');
insert into events(id,club_id,name,starts_at,place,type) values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Trénink',now()+interval '2 days','Park','Běh');
insert into participation(club_id,event_id,member_id,response) values('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','yes');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 begin perform add_club_coach('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003');raise exception 'FAIL coach grants';exception when insufficient_privilege then null;end;
 begin perform remove_club_coach('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');raise exception 'FAIL coach revokes';exception when insufficient_privilege then null;end;
 begin perform set_club_logo('20000000-0000-4000-8000-000000000001');raise exception 'FAIL coach logo';exception when insufficient_privilege then null;end;
 begin perform rename_club('20000000-0000-4000-8000-000000000001','Změna');raise exception 'FAIL coach rename';exception when insufficient_privilege then null;end;
 begin perform archive_club('20000000-0000-4000-8000-000000000001','Klub');raise exception 'FAIL coach archive';exception when insufficient_privilege then null;end;
 begin perform export_club_backup('20000000-0000-4000-8000-000000000001');raise exception 'FAIL coach backup';exception when insufficient_privilege then null;end;
 begin perform create_managed_club('Nový');raise exception 'FAIL coach new club';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$begin
 begin insert into club_roles values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','owner');raise exception 'FAIL two owners';exception when unique_violation then null;end;
 begin update club_roles set role='coach' where club_id='20000000-0000-4000-8000-000000000001' and role='owner';raise exception 'FAIL owner demotion';exception when raise_exception then if sqlerrm='FAIL owner demotion' then raise;end if;end;
 begin delete from clubs where id='20000000-0000-4000-8000-000000000001';raise exception 'FAIL hard delete';exception when insufficient_privilege then null;end;
end $$;
select remove_club_coach('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002');
do $$begin
 if not exists(select 1 from club_roles where club_id='20000000-0000-4000-8000-000000000001' and user_id='10000000-0000-4000-8000-000000000002' and role='member') then raise exception 'FAIL demoted member role';end if;
 if not exists(select 1 from participation where member_id='30000000-0000-4000-8000-000000000002' and response='yes') then raise exception 'FAIL lost attendance';end if;
end $$;
select remove_club_coach('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
select rename_club('20000000-0000-4000-8000-000000000001','Přejmenovaný klub');
do $$declare b jsonb;begin
 b:=export_club_backup('20000000-0000-4000-8000-000000000001');if b->'club'->>'name'<>'Přejmenovaný klub' or jsonb_array_length(b->'tables'->'events')<>1 or jsonb_array_length(b->'tables'->'participation')<>1 then raise exception 'FAIL full backup';end if;
 begin perform archive_club('20000000-0000-4000-8000-000000000001','Klub');raise exception 'FAIL wrong confirmation';exception when raise_exception then if sqlerrm='FAIL wrong confirmation' then raise;end if;end;
end $$;
reset role;
create function public.test_archive_failure() returns trigger language plpgsql as $$begin raise exception 'Simulated backup failure';end $$;
create trigger test_archive_failure before insert on public.club_archives for each row execute function public.test_archive_failure();
set local role authenticated;
do $$begin
 begin perform archive_club('20000000-0000-4000-8000-000000000001','Přejmenovaný klub');raise exception 'FAIL ignored backup failure';exception when raise_exception then if sqlerrm<>'Simulated backup failure' then raise;end if;end;
 if not public.has_club_role('20000000-0000-4000-8000-000000000001',array['owner']) then raise exception 'FAIL backup failure archived club';end if;
end $$;
reset role;
drop trigger test_archive_failure on public.club_archives;
drop function public.test_archive_failure();
set local role authenticated;
select set_config('test.archive',archive_club('20000000-0000-4000-8000-000000000001','Přejmenovaný klub')::text,true);
do $$begin
 if public.has_club_role('20000000-0000-4000-8000-000000000001',array['owner','coach','member']) then raise exception 'FAIL archived access';end if;
 if exists(select 1 from events where club_id='20000000-0000-4000-8000-000000000001') then raise exception 'FAIL archived RLS';end if;
 if (select count(*) from list_archived_clubs())<>1 then raise exception 'FAIL archive recovery list';end if;
 begin perform rename_club('20000000-0000-4000-8000-000000000001','Sabotáž');raise exception 'FAIL archived rename';exception when insufficient_privilege then null;end;
 begin update clubs set archived_at=null where id='20000000-0000-4000-8000-000000000001';raise exception 'FAIL bypass recovery';exception when insufficient_privilege then null;end;
 begin delete from club_archives;raise exception 'FAIL backup deletion';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004"}',true);
do $$begin
 if exists(select 1 from list_archived_clubs()) then raise exception 'FAIL foreign archive list';end if;
 begin perform restore_archived_club(current_setting('test.archive')::uuid);raise exception 'FAIL foreign restore';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
select restore_archived_club(current_setting('test.archive')::uuid);
do $$begin
 if not exists(select 1 from events where club_id='20000000-0000-4000-8000-000000000001') or not public.has_club_role('20000000-0000-4000-8000-000000000001',array['owner']) then raise exception 'FAIL restored data';end if;
end $$;
select set_config('test.expired',archive_club('20000000-0000-4000-8000-000000000001','Přejmenovaný klub')::text,true);
reset role;
do $$begin
 if not exists(select 1 from club_archives where id=current_setting('test.expired')::uuid and expires_at=created_at+interval '3 months' and jsonb_array_length(snapshot->'tables'->'events')=1) then raise exception 'FAIL durable 3-month archive';end if;
end $$;
update club_archives set expires_at=now()-interval '1 day' where id=current_setting('test.expired')::uuid;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$begin
 if exists(select 1 from list_archived_clubs()) then raise exception 'FAIL expired visible';end if;
 begin perform restore_archived_club(current_setting('test.expired')::uuid);raise exception 'FAIL expired restore';exception when insufficient_privilege then null;end;
end $$;
rollback;
