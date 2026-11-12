begin;
insert into auth.users(id) select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,7)n;
insert into clubs(id,name) values('20000000-0000-4000-8000-000000000001','Klub změn'),('20000000-0000-4000-8000-000000000002','Cizí klub');
insert into club_roles values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','member'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','coach'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','member'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000006','owner');
insert into members(id,club_id,user_id,name,kind) select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001',('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Člen '||n,'member' from generate_series(2,3)n;
insert into events(id,club_id,name,starts_at,place,type) values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Běh',now()+interval '2 days','Park','Běh');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
select register_event_push('https://fcm.googleapis.com/fcm/send/member-change',repeat('A',87),repeat('A',22));
do $$begin
 begin perform update_event_with_notice('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','{"place":"Cizí zápis"}');raise exception 'FAIL member edit';exception when insufficient_privilege then null;end;
 begin perform * from event_change_notices;raise exception 'FAIL direct notices exposed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005"}',true);
do $$begin
 begin perform register_event_push('https://fcm.googleapis.com/fcm/send/unlinked',repeat('A',87),repeat('A',22));raise exception 'FAIL unlinked member push';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
-- Unchecked ordinary writes and cosmetic changes must remain silent.
update events set place='Hala' where id='50000000-0000-4000-8000-000000000001';
select update_event_with_notice('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','{"name":"Večerní běh"}');
reset role;
do $$begin if exists(select 1 from event_change_notices) then raise exception 'FAIL silent/cosmetic update notified';end if;end $$;
set local role authenticated;
select update_event_with_notice('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','{"place":"Stadion"}');
-- Replaying the same save must not notify twice.
select update_event_with_notice('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','{"place":"Stadion"}');
reset role;
do $$begin
 if (select count(*) from event_change_notices)<>4 then raise exception 'FAIL club recipients or duplicate save';end if;
 if (select count(*) from coach_push_jobs where notice_id is not null)<>1 then raise exception 'FAIL push subscription routing';end if;
 if not exists(select 1 from event_change_notices where body like '%Hala%Stadion%') then raise exception 'FAIL old/new place missing';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$declare n record;begin
 if (select count(*) from list_event_change_notices('20000000-0000-4000-8000-000000000001'))<>1 then raise exception 'FAIL own inbox';end if;
 if exists(select 1 from list_event_change_notices('20000000-0000-4000-8000-000000000002')) then raise exception 'FAIL foreign inbox';end if;
 select * into n from list_event_change_notices('20000000-0000-4000-8000-000000000001');
 perform read_event_change_notice('20000000-0000-4000-8000-000000000001',n.id);
 if exists(select 1 from list_event_change_notices('20000000-0000-4000-8000-000000000001')) then raise exception 'FAIL mark read';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
-- All notifications from a failed transaction/subtransaction roll back with the edit.
do $$begin
 begin
  perform update_event_with_notice('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','{"place":"Vrátit zpět"}');
  raise check_violation;
 exception when check_violation then null;end;
 begin perform update_event_with_notice('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','{"club_id":"20000000-0000-4000-8000-000000000002"}');raise exception 'FAIL forbidden patch';exception when invalid_parameter_value then null;end;
end $$;
select update_event_with_notice('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','{"status":"cancelled"}');
set local role service_role;
-- The cancellation must be deliverable even though the event is cancelled.
select set_config('stg.change_claimed',(select jsonb_agg(to_jsonb(j))::text from claim_coach_push_jobs(100) j),true);
do $$begin
 if not exists(select 1 from jsonb_array_elements(current_setting('stg.change_claimed')::jsonb) j where j->'payload'->>'body' like '%zrušen%') then raise exception 'FAIL cancellation discarded by worker';end if;
 if exists(select 1 from claim_coach_push_jobs(100)) then raise exception 'FAIL double claim';end if;
end $$;
select finish_coach_push_job((j->>'job_id')::bigint,(j->>'token')::uuid,'sent') from jsonb_array_elements(current_setting('stg.change_claimed')::jsonb)j;
reset role;
do $$begin
 if (select place from events where id='50000000-0000-4000-8000-000000000001')<>'Stadion' then raise exception 'FAIL rolled back edit';end if;
 if (select count(*) from event_change_notices)<>8 then raise exception 'FAIL rollback notices';end if;
end $$;
-- Scoped events: roster members and all staff, including members with no RSVP.
insert into events(id,club_id,name,starts_at,place,type,roster_only,group_name) values('50000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','Skupina',now()+interval '2 days','Stadion','Běh',true,'Skupina');
insert into participation(club_id,event_id,member_id) values('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000002');
set local role authenticated;
select update_event_with_notice('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000004','{"place":"Les"}');
reset role;
do $$begin
 if (select count(*) from event_change_notices where body like '%Stadion%Les%')<>3 then raise exception 'FAIL scoped recipients';end if;
 if exists(select 1 from event_change_notices where body like '%Stadion%Les%' and user_id='10000000-0000-4000-8000-000000000003') then raise exception 'FAIL nonroster recipient';end if;
end $$;
-- Revocation after enqueue must prevent delivery and hide the stored notice.
delete from participation where event_id='50000000-0000-4000-8000-000000000004';
set local role service_role;
do $$begin if exists(select 1 from claim_coach_push_jobs(100)) then raise exception 'FAIL revoked roster delivery';end if;end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin if exists(select 1 from list_event_change_notices('20000000-0000-4000-8000-000000000001') where event_id='50000000-0000-4000-8000-000000000004') then raise exception 'FAIL revoked roster inbox';end if;end $$;
reset role;
-- Series wrapper must use the original conflict checks and roll back its notices.
insert into events(id,club_id,name,starts_at,place,type,series_id) select ('50000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001','Série',now()+n*interval '1 day','Park','Běh','60000000-0000-4000-8000-000000000001' from generate_series(2,3)n;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$declare changes jsonb;broken jsonb;begin
 select jsonb_agg(jsonb_build_object('id',id,'expected_starts_at',starts_at,'expected_status',status) order by id) into changes from events where series_id='60000000-0000-4000-8000-000000000001';
 broken:=jsonb_set(changes,'{1,expected_status}','"cancelled"');
 begin perform change_training_series_with_notice('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','cancel',broken);raise exception 'FAIL partial series accepted';exception when raise_exception then if sqlerrm='FAIL partial series accepted' then raise;end if;end;
 if exists(select 1 from events where series_id='60000000-0000-4000-8000-000000000001' and status<>'scheduled') then raise exception 'FAIL partial series state';end if;
 perform change_training_series_with_notice('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','cancel',changes);
 begin perform change_training_series_with_notice('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','cancel',changes);raise exception 'FAIL stale series accepted';exception when raise_exception then if sqlerrm='FAIL stale series accepted' then raise;end if;end;
end $$;
reset role;
do $$begin if (select count(*) from event_change_notices where event_id in ('50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003'))<>8 then raise exception 'FAIL atomic series notices';end if;end $$;
-- An explicitly requested correction can also notify about an ongoing/past event.
insert into events(id,club_id,name,starts_at,place,type) values('50000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000001','Starší trénink','2020-01-01T18:00:00Z','Park','Běh');
set local role authenticated;
select update_event_with_notice('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000006','{"starts_at":"2020-01-02T19:00:00Z"}');
select update_event_with_notice('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000006','{"event_location":{"point":{"lat":49,"lng":18},"arrows":[],"note":"Zadní brána"}}');
reset role;
do $$begin
 if (select count(*) from event_change_notices where event_id='50000000-0000-4000-8000-000000000006')<>8 then raise exception 'FAIL explicit past/map notices';end if;
 if not exists(select 1 from event_change_notices where body like '%01. 01. 2020 19:00%02. 01. 2020 20:00%') then raise exception 'FAIL old/new time or Prague timezone';end if;
 if not exists(select 1 from event_change_notices where body like '%Místo na mapě%') then raise exception 'FAIL map change';end if;
end $$;
rollback;
