begin;
insert into auth.users(id) values('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into clubs(id,name) values('20000000-0000-4000-8000-000000000001','Fiktivní titulní fotografie'),('20000000-0000-4000-8000-000000000002','Jiný klub');
insert into club_roles values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','coach'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member');
insert into events(id,club_id,name,starts_at,place,type) values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Test',now()-interval '2 days','Park','Běh');
insert into storage.objects(bucket_id,name) values('club-photos','20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000001.jpg');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
update events set cover_photo_path='20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000001.jpg' where id='50000000-0000-4000-8000-000000000001';
do $$begin
 if not exists(select 1 from events where cover_photo_path is not null) then raise exception 'FAIL cover not saved';end if;
 begin
  update events set cover_photo_path='20000000-0000-4000-8000-000000000002/50000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000001.jpg';
  raise exception 'FAIL foreign path allowed';
 exception when raise_exception then if sqlerrm='FAIL foreign path allowed' then raise;end if;end;
 begin
  update events set cover_photo_path='20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000009.jpg';
  raise exception 'FAIL missing file allowed';
 exception when raise_exception then if sqlerrm='FAIL missing file allowed' then raise;end if;end;
end $$;
-- Selecting the cover is presentation-only; it does not reopen a completed review.
insert into members(id,club_id,name,kind) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Host','guest');
insert into participation(club_id,event_id,member_id,attended) values('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',true);
update events set actual_notes='Hotovo' where id='50000000-0000-4000-8000-000000000001';
update events set completed_at=now(),completed_by=auth.uid() where id='50000000-0000-4000-8000-000000000001';
update events set cover_photo_path=null where id='50000000-0000-4000-8000-000000000001';
do $$begin if not exists(select 1 from events where completed_at is not null and cover_photo_path is null) then raise exception 'FAIL cover change reopened review';end if;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$declare n integer;begin
 update events set cover_photo_path='20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000001.jpg';
 get diagnostics n=row_count;if n<>0 then raise exception 'FAIL member changed cover';end if;
end $$;
rollback;
