begin;
insert into auth.users(id) select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,3)n;
insert into clubs(id,name) values('20000000-0000-4000-8000-000000000001','Fotografie členů'),('20000000-0000-4000-8000-000000000002','Cizí klub');
insert into club_roles values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member');
insert into members(id,club_id,user_id,name,kind) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Člen','member');
insert into events(id,club_id,name,starts_at,place,type,event_kind,roster_only,group_name) values
('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Veřejný v klubu',now()-interval '2 days','Park','Běh','training',false,''),
('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Skrytá skupina',now()-interval '2 days','Park','Běh','training',true,'Skupina'),
('50000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','Cizí trénink',now()-interval '2 days','Park','Běh','training',false,''),
('50000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','Závod',now()-interval '2 days','Park','OCR','race',false,'');
insert into storage.objects(bucket_id,name) select 'club-photos',club_id::text||'/'||id::text||'/60000000-0000-4000-8000-000000000001.jpg' from events;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$declare n integer;begin
 if (select count(*) from storage.objects where bucket_id='club-photos')<>1 then raise exception 'FAIL member photo audience';end if;
 if public.can_read_event_photo('20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000001.jpg') then raise exception 'FAIL staff mutation helper expanded';end if;
 if public.can_view_member_training_photo('invalid/file.jpg') then raise exception 'FAIL invalid path';end if;
 delete from storage.objects where bucket_id='club-photos';get diagnostics n=row_count;if n<>0 then raise exception 'FAIL member deletes photos';end if;
 update events set cover_photo_path='20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000001.jpg';get diagnostics n=row_count;if n<>0 then raise exception 'FAIL member changes cover';end if;
 begin insert into storage.objects(bucket_id,name) values('club-photos','20000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000002.jpg');raise exception 'FAIL member uploads photo';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
do $$begin if exists(select 1 from storage.objects) then raise exception 'FAIL outsider sees photos';end if;end $$;
reset role;
insert into participation(club_id,event_id,member_id,response) values('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','yes');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin if (select count(*) from storage.objects)<>2 then raise exception 'FAIL invited group photo unavailable';end if;end $$;
reset role;
update members set removed_at=now() where id='30000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin if exists(select 1 from storage.objects) then raise exception 'FAIL removed member sees photos';end if;end $$;
reset role;
set local role anon;
do $$begin if exists(select 1 from storage.objects) then raise exception 'FAIL anonymous photo access';end if;end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$begin if (select count(*) from storage.objects)<>3 then raise exception 'FAIL owner photo access changed';end if;end $$;
rollback;
