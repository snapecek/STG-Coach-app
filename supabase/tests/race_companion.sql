begin;
insert into auth.users(id,email,email_confirmed_at) values ('10000000-0000-4000-8000-000000000001','coach@example.invalid',now()),('10000000-0000-4000-8000-000000000002','member@example.invalid',now()),('10000000-0000-4000-8000-000000000003','wrong@example.invalid',now());
insert into public.clubs(id,name) values ('20000000-0000-4000-8000-000000000001','Fiktivní tým'),('20000000-0000-4000-8000-000000000002','Cizí tým');
insert into public.club_roles values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','coach');
insert into public.members(id,club_id,name,kind) values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fiktivní člen','guest'),('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Jiný člen','member');
insert into public.events(id,club_id,name,starts_at,place,type,event_kind) values ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Trénink',now()+interval '2 days','Park','Kondice','training'),('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Závod',now()+interval '3 days','Les','OCR','race');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
select set_config('stg.test_invite',(public.issue_club_invitation('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',' MEMBER@example.invalid ')->>'token'),true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
do $$begin
 begin perform public.accept_club_invitation(current_setting('stg.test_invite'));raise exception 'FAIL wrong email accepts';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
 if exists(select 1 from public.club_invitations) then raise exception 'FAIL outsider sees invitations';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
select public.accept_club_invitation(current_setting('stg.test_invite'));
do $$declare r jsonb;begin
 if (select count(*) from member_event_roster('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001'))<>2 then raise exception 'FAIL whole club roster';end if;
 select to_jsonb(x) into r from member_event_roster('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001') x where is_self;
 if r is null or r ? 'attended' or r ? 'email' or r ? 'user_id' then raise exception 'FAIL minimal own roster';end if;
 if (select count(*) from member_event_roster('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002') where is_self and response is null)<>1 then raise exception 'FAIL open race roster';end if;
 begin perform member_event_roster('20000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001');raise exception 'FAIL foreign club';exception when insufficient_privilege then null;end;
 if exists(select 1 from members) or exists(select 1 from participation) then raise exception 'FAIL staff access expanded';end if;
end $$;
reset role;
update events set roster_only=true,group_name='Fiktivní soupiska' where false;
insert into events(id,club_id,name,starts_at,place,type,event_kind,roster_only,group_name) values ('50000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','Skupina',now()+interval '3 days','Park','Běh','training',true,'Fiktivní skupina');
insert into participation(club_id,event_id,member_id,response) values ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000002','maybe');
set local role authenticated;
do $$begin
 begin perform member_event_roster('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003');raise exception 'FAIL uninvited group';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into participation(club_id,event_id,member_id,response) values ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001','yes');
set local role authenticated;
do $$begin if (select count(*) from member_event_roster('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003'))<>2 then raise exception 'FAIL selected roster';end if;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
do $$begin begin perform member_event_roster('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001');raise exception 'FAIL outsider';exception when insufficient_privilege then null;end;end $$;
reset role;
set local role anon;
do $$begin begin perform member_event_roster('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001');raise exception 'FAIL anon';exception when insufficient_privilege then null;end;end $$;

reset role;
insert into participation(club_id,event_id,member_id) values ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
select respond_to_club_event('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','companion');
do $$declare p participation;begin
 select * into strict p from my_club_participation('20000000-0000-4000-8000-000000000001') where event_id='50000000-0000-4000-8000-000000000002';
 if p.response<>'companion' or p.attended is not null then raise exception 'FAIL companion RSVP';end if;
 begin perform respond_to_club_event('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','companion');raise exception 'FAIL training companion';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$begin
 begin insert into race_results(club_id,event_id,member_id,status) values ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','dns');raise exception 'FAIL companion result';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
 begin update events set event_kind='training' where id='50000000-0000-4000-8000-000000000002';raise exception 'FAIL companion changed to training';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
do $$begin
 begin perform save_race_team('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001','Fiktivní tým','Test',array['30000000-0000-4000-8000-000000000001']::uuid[],null);raise exception 'FAIL companion team';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
update events set starts_at=now()-interval '2 days' where id='50000000-0000-4000-8000-000000000002';
do $$begin begin update events set completed_at=now() where id='50000000-0000-4000-8000-000000000002';raise exception 'FAIL unverified companion completed';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;end $$;
update participation set attended=true,confirmed_by='10000000-0000-4000-8000-000000000001' where event_id='50000000-0000-4000-8000-000000000002';
update events set completed_at=now() where id='50000000-0000-4000-8000-000000000002';
do $$begin if not exists(select 1 from events where id='50000000-0000-4000-8000-000000000002' and completed_at is not null) then raise exception 'FAIL companion needs no race result';end if;end $$;
-- Removing and re-adding must not require old RSVP as new attendance.
reset role;
insert into events(id,club_id,name,starts_at,place,type,actual_notes) values ('50000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','Test obnovení',now()-interval '1 day','Park','Kondice','Průběh');
insert into participation(club_id,event_id,member_id,response) values ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000001','no');
alter table members disable trigger members_retention;
update members set removed_at=now()-interval '2 days',purge_after=now()+interval '1 year' where id='30000000-0000-4000-8000-000000000001';
alter table members enable trigger members_retention;
insert into participation(club_id,event_id,member_id,attended) values ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
update events set completed_at=now() where id='50000000-0000-4000-8000-000000000004';
rollback;
