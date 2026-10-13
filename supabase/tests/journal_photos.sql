-- Local/disposable development DB after all migrations. No physical files are created here.
begin;
insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000001','coach-a@example.invalid'),('10000000-0000-4000-8000-000000000002','member-a@example.invalid');
insert into public.clubs(id,name) values('20000000-0000-4000-8000-000000000001','Fiktivní A'),('20000000-0000-4000-8000-000000000002','Fiktivní B');
insert into public.club_roles(club_id,user_id,role) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','coach'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member');
insert into public.events(id,club_id,name,starts_at,type,place) values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Událost A',now()-interval '2 days','Běh','Park'),('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Událost B',now()-interval '2 days','Běh','Park');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into storage.objects(bucket_id,name) values('club-photos','20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000001.jpg');
do $$begin
 if (select count(*) from storage.objects)<>1 then raise exception 'FAIL own photo inaccessible';end if;
 begin
  insert into storage.objects(bucket_id,name) values('club-photos','20000000-0000-4000-8000-000000000002/50000000-0000-4000-8000-000000000002/60000000-0000-4000-8000-000000000002.jpg');
  raise exception 'FAIL foreign club upload allowed';
 exception when insufficient_privilege then null;end;
 begin
  insert into storage.objects(bucket_id,name) values('club-photos','20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000002/60000000-0000-4000-8000-000000000002.jpg');
  raise exception 'FAIL foreign event upload allowed';
 exception when insufficient_privilege then null;end;
 begin
  insert into storage.objects(bucket_id,name) values('club-photos','invalid/invalid/photo.svg');raise exception 'FAIL invalid path allowed';
 exception when insufficient_privilege then null;end;
 begin
  delete from public.events where id='50000000-0000-4000-8000-000000000001';raise exception 'FAIL event deletion left a photo behind';
 exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
update public.events set status='cancelled' where id='50000000-0000-4000-8000-000000000001';
do $$begin
 begin
  insert into storage.objects(bucket_id,name) values('club-photos','20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000005.jpg');raise exception 'FAIL cancelled event upload allowed';
 exception when insufficient_privilege then null;end;
end $$;
update public.events set status='scheduled' where id='50000000-0000-4000-8000-000000000001';
insert into storage.objects(bucket_id,name)
 select 'club-photos','20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/'||gen_random_uuid()::text||'.jpg' from generate_series(1,19);
do $$begin
 if (select count(*) from storage.objects)<>20 then raise exception 'FAIL photo capacity';end if;
 begin
  insert into storage.objects(bucket_id,name) values('club-photos','20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000004.jpg');raise exception 'FAIL 21st photo accepted';
 exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from storage.objects) then raise exception 'FAIL member photo visibility';end if;
 begin
  insert into storage.objects(bucket_id,name) values('club-photos','20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000003.jpg');raise exception 'FAIL member upload allowed';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$begin
 if exists(select 1 from storage.objects) then raise exception 'FAIL anonymous visibility';end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
delete from storage.objects where bucket_id='club-photos';
delete from public.events where id='50000000-0000-4000-8000-000000000001';
do $$begin
 if exists(select 1 from public.events) then raise exception 'FAIL own event not deleted';end if;
end $$;
reset role;
rollback;
