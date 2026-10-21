begin;
insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000001','owner@example.invalid'),('10000000-0000-4000-8000-000000000002','member@example.invalid');
insert into public.clubs(id,name) values('20000000-0000-4000-8000-000000000001','Fiktivní klub'),('20000000-0000-4000-8000-000000000099','Jiný klub');
insert into public.club_roles(club_id,user_id,role) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member');
insert into public.members(id,club_id,user_id,name,kind) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Fiktivní člen','member');
update public.club_live_changes set revision=0,change_xid='0'::xid8;
insert into public.templates(club_id,name,type,place,minutes) select '20000000-0000-4000-8000-000000000001'::uuid,'Šablona '||i,'Kondice','Park',60 from generate_series(1,30) i;
do $$begin
 if (select revision from public.club_live_changes where club_id='20000000-0000-4000-8000-000000000001')<>1 then raise exception 'FAIL batch must emit one counter update';end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='club_live_changes') then raise exception 'FAIL publication missing';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 if not public.club_live_sync_ready() then raise exception 'FAIL capability';end if;
 if (select count(*) from public.club_live_changes)<>1 then raise exception 'FAIL member read scope';end if;
 begin update public.club_live_changes set revision=9;raise exception 'FAIL client write allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.members set removed_at=now(),purge_after=now()+interval '30 days';
set local role authenticated;
do $$begin if exists(select 1 from public.club_live_changes) then raise exception 'FAIL removed member reads signals';end if;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$begin if (select count(*) from public.club_live_changes)<>1 then raise exception 'FAIL owner read scope';end if;end $$;
reset role;
update public.clubs set archived_at=now() where id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin if exists(select 1 from public.club_live_changes) then raise exception 'FAIL archived club signals';end if;end $$;
rollback;
