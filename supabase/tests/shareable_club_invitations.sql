begin;
insert into auth.users(id,email,email_confirmed_at) select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'shared'||n||'@example.invalid',case when n=5 then null else now() end from generate_series(1,8)n;
insert into clubs(id,name,applications_open) values('20000000-0000-4000-8000-000000000001','Soukromý klub',false),('20000000-0000-4000-8000-000000000002','Cizí klub',false),('20000000-0000-4000-8000-000000000003','Archivovaný klub',false);
insert into club_roles values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','coach'),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000006','owner'),('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000007','member');
insert into members(id,club_id,user_id,name,kind) values('30000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000007','Stávající člen','member');
insert into events(id,club_id,name,starts_at,place,type) values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Soukromý trénink',now()+interval '1 day','Park','Běh');
set local role anon;
do $$begin
 begin perform issue_join_link('20000000-0000-4000-8000-000000000001');raise exception 'FAIL anonymous issue';exception when insufficient_privilege then null;end;
 begin perform joinable_clubs(repeat('a',64));raise exception 'FAIL anonymous club discovery';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000007"}',true);
do $$begin begin perform issue_join_link('20000000-0000-4000-8000-000000000001');raise exception 'FAIL member issue';exception when insufficient_privilege then null;end;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$declare issued jsonb;begin
 issued:=issue_join_link('20000000-0000-4000-8000-000000000001');perform set_config('test.share_token',issued->>'token',true);perform set_config('test.share_id',issued->>'id',true);
 if (issued->>'token') !~ '^[a-f0-9]{64}$' then raise exception 'FAIL weak token';end if;
 if (issued->>'expires_at')::timestamptz<>now()+interval '7 days' then raise exception 'FAIL expiry';end if;
 begin perform token_hash from club_join_links;raise exception 'FAIL token hash exposed';exception when insufficient_privilege then null;end;
 begin insert into club_join_links(club_id,token_hash) values('20000000-0000-4000-8000-000000000001',repeat('a',64));raise exception 'FAIL direct insert';exception when insufficient_privilege then null;end;
 begin perform issue_join_link('20000000-0000-4000-8000-000000000002');raise exception 'FAIL foreign issue';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin if (select token_hash from club_join_links where id=current_setting('test.share_id')::uuid)=current_setting('test.share_token') then raise exception 'FAIL plaintext stored';end if;end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
do $$declare r uuid;begin
 if (select count(*) from joinable_clubs())<>0 then raise exception 'FAIL closed directory';end if;
 if not exists(select 1 from joinable_clubs(current_setting('test.share_token')) where id='20000000-0000-4000-8000-000000000001' and invited) then raise exception 'FAIL shared private club unavailable';end if;
 if exists(select 1 from club_join_links) then raise exception 'FAIL applicant lists links';end if;
 begin perform submit_club_application('20000000-0000-4000-8000-000000000002','Jan','Novák',current_setting('test.share_token'));raise exception 'FAIL cross-club admission';exception when insufficient_privilege then null;end;
 begin perform submit_club_application('20000000-0000-4000-8000-000000000001','Jan','Novák');raise exception 'FAIL missing token';exception when insufficient_privilege then null;end;
 r:=submit_club_application('20000000-0000-4000-8000-000000000001','Jan','Novák',current_setting('test.share_token'));perform set_config('test.share_request',r::text,true);
 if submit_club_application('20000000-0000-4000-8000-000000000001','Jiné','Jméno',current_setting('test.share_token'))<>r then raise exception 'FAIL duplicate application';end if;
 if has_club_role('20000000-0000-4000-8000-000000000001',array['member']) or exists(select 1 from events) then raise exception 'FAIL access before approval';end if;
 begin perform issue_join_link('20000000-0000-4000-8000-000000000001');raise exception 'FAIL applicant invites';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004"}',true);
do $$begin perform submit_club_application('20000000-0000-4000-8000-000000000001','Jana','Nová',current_setting('test.share_token'));if (select count(*) from my_club_applications() where status='pending')<>1 then raise exception 'FAIL second applicant cannot reuse link';end if;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005"}',true);
do $$begin
 if exists(select 1 from joinable_clubs(current_setting('test.share_token'))) then raise exception 'FAIL unverified private club discovery';end if;
 begin perform submit_club_application('20000000-0000-4000-8000-000000000001','Bez','Ověření',current_setting('test.share_token'));raise exception 'FAIL unverified application';exception when raise_exception then if sqlerrm<>'Verified email required' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000006"}',true);
do $$begin begin perform revoke_join_link(current_setting('test.share_id')::uuid);raise exception 'FAIL foreign revoke';exception when insufficient_privilege then null;end;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
select revoke_join_link(current_setting('test.share_id')::uuid);
do $$begin
 if (select count(*) from club_join_requests where status='pending')<>2 then raise exception 'FAIL revocation deleted requests';end if;
 perform review_club_application(current_setting('test.share_request')::uuid,true);
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
do $$begin if not has_club_role('20000000-0000-4000-8000-000000000001',array['member']) then raise exception 'FAIL approval after revocation';end if;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000008"}',true);
do $$begin
 if exists(select 1 from joinable_clubs(current_setting('test.share_token'))) then raise exception 'FAIL revoked link discovery';end if;
 begin perform submit_club_application('20000000-0000-4000-8000-000000000001','Pozdě','Příchozí',current_setting('test.share_token'));raise exception 'FAIL revoked link admission';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$declare issued jsonb;begin issued:=issue_join_link('20000000-0000-4000-8000-000000000001');perform set_config('test.expired_token',issued->>'token',true);perform set_config('test.expired_id',issued->>'id',true);issued:=issue_join_link('20000000-0000-4000-8000-000000000003');perform set_config('test.archived_token',issued->>'token',true);perform set_config('test.archived_id',issued->>'id',true);end $$;
reset role;
update club_join_links set expires_at=now()-interval '1 second' where id=current_setting('test.expired_id')::uuid;
do $$begin if not (build_club_snapshot('20000000-0000-4000-8000-000000000003')->'tables' ? 'club_join_links') then raise exception 'FAIL links excluded from backup';end if;end $$;
update clubs set archived_at=now(),archive_expires_at=now()+interval '3 months' where id='20000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000008"}',true);
do $$begin
 if exists(select 1 from joinable_clubs(current_setting('test.expired_token'))) or exists(select 1 from joinable_clubs(current_setting('test.archived_token'))) then raise exception 'FAIL expired/archived link discovery';end if;
 begin perform submit_club_application('20000000-0000-4000-8000-000000000001','Pozdě','Příchozí',current_setting('test.expired_token'));raise exception 'FAIL expired link admission';exception when insufficient_privilege then null;end;
 begin perform submit_club_application('20000000-0000-4000-8000-000000000003','Pozdě','Příchozí',current_setting('test.archived_token'));raise exception 'FAIL archived club admission';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$begin begin perform issue_join_link('20000000-0000-4000-8000-000000000003');raise exception 'FAIL archived club invite';exception when insufficient_privilege then null;end;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000006"}',true);
do $$begin
 for n in 1..20 loop perform issue_join_link('20000000-0000-4000-8000-000000000002');end loop;
 begin perform issue_join_link('20000000-0000-4000-8000-000000000002');raise exception 'FAIL invitation rate limit';exception when raise_exception then if sqlerrm<>'Invitation limit reached' then raise;end if;end;
end $$;
rollback;
