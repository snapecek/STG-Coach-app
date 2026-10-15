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
-- An existing race without a participation row is already visible.
do $$begin
 if not exists(select 1 from events where id='50000000-0000-4000-8000-000000000002') then raise exception 'FAIL existing empty race hidden';end if;
 begin perform create_club_race('20000000-0000-4000-8000-000000000001','{}',array[]::uuid[]);raise exception 'FAIL member creates race';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
select create_club_race('20000000-0000-4000-8000-000000000001',jsonb_build_object('id','50000000-0000-4000-8000-000000000003','name','Nový prázdný závod','place','Les','type','OCR','starts_at',now()+interval '5 days','duration_minutes',120),array[]::uuid[]);
do $$begin
 if exists(select 1 from participation where event_id='50000000-0000-4000-8000-000000000003') then raise exception 'FAIL invented participants';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$declare p participation;answer text;begin
 if not exists(select 1 from events where id='50000000-0000-4000-8000-000000000003') then raise exception 'FAIL new empty race hidden';end if;
 if (select count(*) from member_event_roster('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003'))<>1 then raise exception 'FAIL unregistered roster exposes other members';end if;
 foreach answer in array array['yes','maybe','no','companion','yes'] loop
  p:=respond_to_club_event('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003',answer);
  if p.member_id<>'30000000-0000-4000-8000-000000000001' or p.response<>answer or p.attended is not null or p.confirmed_by is not null then raise exception 'FAIL self RSVP or attendance';end if;
 end loop;
 if (select count(*) from my_club_participation('20000000-0000-4000-8000-000000000001') where event_id='50000000-0000-4000-8000-000000000003')<>1 then raise exception 'FAIL duplicate registration';end if;
end $$;
reset role;
update participation set attended=true,confirmed_by='10000000-0000-4000-8000-000000000001' where event_id='50000000-0000-4000-8000-000000000003';
set local role authenticated;
do $$declare p participation;begin
 p:=respond_to_club_event('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003','maybe');
 if p.attended is distinct from true or p.confirmed_by<>'10000000-0000-4000-8000-000000000001' then raise exception 'FAIL changed attendance';end if;
end $$;
reset role;
update events set starts_at=now()-interval '1 day' where id='50000000-0000-4000-8000-000000000003';
set local role authenticated;
do $$begin
 begin perform respond_to_club_event('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003','yes');raise exception 'FAIL past race RSVP';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
rollback;
