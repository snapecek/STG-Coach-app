begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-4000-8000-000000000001','coach@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000002','member@example.invalid',now());
insert into clubs(id,name) values('20000000-0000-4000-8000-000000000001','Synchronizační klub'),('20000000-0000-4000-8000-000000000002','Jiný klub');
insert into club_roles values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member');
insert into members(id,club_id,user_id,name,kind) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Člen','member');
insert into events(id,club_id,name,starts_at,place,type) values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Trénink',now()+interval '24 hours','Park','Běh');
insert into participation(club_id,event_id,member_id) values('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$declare delta jsonb;begin
 delta:=club_workspace_changes('20000000-0000-4000-8000-000000000001');
 if jsonb_array_length(delta->'changes')<>0 or (delta->>'cursor')!~'^[0-9]+$' then raise exception 'FAIL checkpoint';end if;
 delta:=club_workspace_changes('20000000-0000-4000-8000-000000000001','0');
 if jsonb_array_length(delta->'changes')<>3 then raise exception 'FAIL initial entities: %',delta;end if;
 if not exists(select 1 from jsonb_array_elements(delta->'changes') c where c->>'kind'='participation' and c->>'key'='50000000-0000-4000-8000-000000000001:30000000-0000-4000-8000-000000000001') then raise exception 'FAIL composite key';end if;
 begin perform club_workspace_changes('20000000-0000-4000-8000-000000000002','0');raise exception 'FAIL cross club';exception when insufficient_privilege then null;end;
 begin perform club_notification_status('20000000-0000-4000-8000-000000000002');raise exception 'FAIL cross club status';exception when insufficient_privilege then null;end;
 begin perform 1 from club_workspace_entities;raise exception 'FAIL direct tracking read';exception when insufficient_privilege then null;end;
 if notification_preferences_ready() is not true then raise exception 'FAIL preference readiness';end if;
end $$;
update events set name='Změněný trénink' where id='50000000-0000-4000-8000-000000000001';
do $$begin
 if (select c->'row'->>'name' from jsonb_array_elements(club_workspace_changes('20000000-0000-4000-8000-000000000001','0')->'changes') c where c->>'kind'='events')<>'Změněný trénink' then raise exception 'FAIL current row';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 begin perform club_workspace_changes('20000000-0000-4000-8000-000000000001','0');raise exception 'FAIL member workspace read';exception when insufficient_privilege then null;end;
 begin perform club_notification_status('20000000-0000-4000-8000-000000000001');raise exception 'FAIL member status read';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin if (select count(*) from eligible_member_rsvp_emails())<>1 then raise exception 'FAIL default email';end if;end $$;
select claim_member_rsvp_email_jobs();
update auth.users set raw_user_meta_data='{"rsvp_email_enabled":false}' where id='10000000-0000-4000-8000-000000000002';
do $$begin
 if exists(select 1 from eligible_member_rsvp_emails()) then raise exception 'FAIL opted out email';end if;
 if exists(select 1 from member_rsvp_email_jobs j cross join lateral prepare_member_rsvp_email(j.id,j.lease_token)) then raise exception 'FAIL opted out queued email';end if;
end $$;
update auth.users set raw_user_meta_data='{"rsvp_email_enabled":"malformed boolean"}' where id='10000000-0000-4000-8000-000000000002';
do $$begin if (select count(*) from eligible_member_rsvp_emails())<>1 then raise exception 'FAIL malformed preference';end if;end $$;
-- Rollback and cascading deletion must produce convergent tombstones.
savepoint mutation;
delete from events where id='50000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$declare delta jsonb;begin
 delta:=club_workspace_changes('20000000-0000-4000-8000-000000000001','0');
 if exists(select 1 from jsonb_array_elements(delta->'changes') c where c->>'kind' in ('events','participation') and c->'row'<>'null'::jsonb) then raise exception 'FAIL cascade tombstones';end if;
 if club_notification_status('20000000-0000-4000-8000-000000000001')->>'email_pending'<>'0' then raise exception 'FAIL queue cascade';end if;
end $$;
reset role;
rollback to mutation;
do $$begin if not exists(select 1 from events where id='50000000-0000-4000-8000-000000000001') then raise exception 'FAIL rollback';end if;end $$;
-- Bounded delta response requests a fresh snapshot, never silently truncates.
insert into members(club_id,name,kind) select '20000000-0000-4000-8000-000000000001','Host '||n,'guest' from generate_series(1,501)n;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$begin if (club_workspace_changes('20000000-0000-4000-8000-000000000001','0')->>'reset')::boolean is not true then raise exception 'FAIL bounded reset';end if;end $$;
reset role;
set local role anon;
do $$begin
 begin perform club_workspace_changes('20000000-0000-4000-8000-000000000001','0');raise exception 'FAIL anon';exception when insufficient_privilege then null;end;
end $$;
rollback;
