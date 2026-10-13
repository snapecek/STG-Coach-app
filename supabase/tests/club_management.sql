-- Disposable/development DB only, after both migrations. All fixtures roll back.
begin;
insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000001','owner@example.invalid'),('10000000-0000-4000-8000-000000000002','member@example.invalid');
insert into public.clubs(id,name) values('20000000-0000-4000-8000-000000000001','Fiktivní klub');
insert into public.club_roles(club_id,user_id,role) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member');
insert into public.members(id,club_id,user_id,name,kind) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Fiktivní člen','member');
insert into public.templates(id,club_id,name,type,place,minutes,plan) values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Šablona','Kondice','Park',60,'Původní plán');
insert into public.events(id,club_id,template_id,name,starts_at,type,place,plan) values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Trénink',now()-interval '2 days','Kondice','Park','Původní plán');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$declare archived public.members;restored public.members;begin
 archived:=public.archive_club_member('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');
 if archived.removed_at is null or archived.purge_after>now()+interval '3 years' then raise exception 'FAIL archive retention';end if;
 if exists(select 1 from public.club_roles where user_id='10000000-0000-4000-8000-000000000002') then raise exception 'FAIL removed membership access';end if;
 restored:=public.archive_club_member(archived.club_id,archived.id,true);
 if restored.id<>archived.id or restored.removed_at is not null or not exists(select 1 from public.club_roles where user_id=restored.user_id and role='member') then raise exception 'FAIL restore';end if;
end $$;
-- Template deletion keeps event snapshots and clears only the template reference.
delete from public.templates where id='40000000-0000-4000-8000-000000000001';
do $$begin
 if not exists(select 1 from public.events where template_id is null and plan='Původní plán') then raise exception 'FAIL deleting used template';end if;
 begin
  update public.events set completed_at=now() where id='50000000-0000-4000-8000-000000000001';
  raise exception 'FAIL incomplete event finalized';
 exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
update public.events set actual_notes='Fiktivní skutečný průběh' where id='50000000-0000-4000-8000-000000000001';
do $$begin
 begin
  update public.events set completed_at=now() where id='50000000-0000-4000-8000-000000000001';
  raise exception 'FAIL missing attendance accepted';
 exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
insert into public.participation(club_id,event_id,member_id,attended) values('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',true);
update public.events set completed_at=now() where id='50000000-0000-4000-8000-000000000001';
do $$begin
 if not exists(select 1 from public.events where completed_at is not null and completed_by=auth.uid()) then raise exception 'FAIL completion';end if;
end $$;
update public.participation set response='maybe';
do $$begin
 if exists(select 1 from public.events where completed_at is not null) then raise exception 'FAIL attendance edit did not reopen review';end if;
end $$;
update public.events set completed_at=now() where id='50000000-0000-4000-8000-000000000001';
update public.events set status='cancelled' where id='50000000-0000-4000-8000-000000000001';
do $$begin
 if exists(select 1 from public.events where completed_at is not null) then raise exception 'FAIL cancelled complete';end if;
end $$;
select public.archive_club_member('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');
reset role;
-- Simulate an expired fixture; only test admin can bypass the clock guard.
alter table public.members disable trigger members_retention;
update public.members set removed_at=now()-interval '4 years',purge_after=now()-interval '1 year';
alter table public.members enable trigger members_retention;
set local role authenticated;
do $$begin
 if exists(select 1 from public.members) or exists(select 1 from public.participation) then raise exception 'FAIL expired personal data visible';end if;
 begin
  perform public.archive_club_member('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',true);
  raise exception 'FAIL expired member restored';
 exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
 begin
  perform public.purge_expired_members();raise exception 'FAIL ordinary user can invoke global purge';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$declare removed integer;begin
 removed:=public.purge_expired_members();
 if removed<>1 or exists(select 1 from public.members) or exists(select 1 from public.participation) then raise exception 'FAIL retention cleanup';end if;
end $$;
rollback;
