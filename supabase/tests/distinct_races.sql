begin;
insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000001','coach@example.invalid'),('10000000-0000-4000-8000-000000000002','member@example.invalid');
insert into public.clubs(id,name) values ('20000000-0000-4000-8000-000000000001','Fiktivní klub'),('20000000-0000-4000-8000-000000000002','Cizí klub');
insert into public.club_roles values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','coach'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member');
insert into public.members(id,club_id,name,kind) values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fiktivní závodník','guest'),('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Nezávodí','member'),('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','Cizí člen','member');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.create_club_race('20000000-0000-4000-8000-000000000001',jsonb_build_object('id','50000000-0000-4000-8000-000000000001','name','Fiktivní závod','place','Park','type','OCR','starts_at',now()-interval '2 days','duration_minutes',120,'race_distance_km',8,'race_registration_url','https://example.invalid/race'),array['30000000-0000-4000-8000-000000000001']::uuid[]);
do $$begin
 if (select count(*) from public.participation)<>1 then raise exception 'FAIL race enrolled whole club';end if;
 begin update public.events set completed_at=now();raise exception 'FAIL missing outcomes';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
 begin perform public.create_club_race('20000000-0000-4000-8000-000000000001','{}',array['30000000-0000-4000-8000-000000000003']::uuid[]);raise exception 'FAIL foreign entrant';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
 begin perform public.create_club_race('20000000-0000-4000-8000-000000000001','{}',array[]::uuid[]);raise exception 'FAIL empty roster';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
update public.participation set attended=true;
insert into public.race_results values ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','dns',null,'');
do $$begin
 begin update public.events set completed_at=now();raise exception 'FAIL DNS with present attendance';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
do $$begin
 begin delete from public.participation;raise exception 'FAIL removed entrant with result';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
 begin perform public.create_club_race('20000000-0000-4000-8000-000000000001',jsonb_build_object('id','50000000-0000-4000-8000-000000000002','name','Invalid registration','place','Park','type','OCR','starts_at',now(),'duration_minutes',60,'race_registration_url','javascript:alert(1)'),array['30000000-0000-4000-8000-000000000001']::uuid[]);raise exception 'FAIL unsafe registration';exception when check_violation then null;end;
 if (select count(*) from public.events)<>1 or (select count(*) from public.participation)<>1 then raise exception 'FAIL partial race creation';end if;
end $$;
update public.participation set attended=false;
update public.events set completed_at=now();
do $$begin if not exists(select 1 from public.events where completed_at is not null and actual_notes='') then raise exception 'FAIL race requires training journal or non-entrants';end if;end $$;
update public.race_results set status='finished',elapsed_ms=300000;
do $$begin
 if exists(select 1 from public.events where completed_at is not null) then raise exception 'FAIL outcome did not reopen';end if;
 begin update public.events set completed_at=now();raise exception 'FAIL finisher absent';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
update public.participation set attended=true;
update public.events set completed_at=now();
do $$begin if not exists(select 1 from public.events where completed_at is not null) then raise exception 'FAIL valid race not complete';end if;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$begin begin perform public.create_club_race('20000000-0000-4000-8000-000000000001','{}',array['30000000-0000-4000-8000-000000000001']::uuid[]);raise exception 'FAIL member creates race';exception when insufficient_privilege then null;end;end $$;
reset role;
delete from public.members where id='30000000-0000-4000-8000-000000000001';
do $$begin if exists(select 1 from public.race_results) or exists(select 1 from public.participation) or not exists(select 1 from public.events where completed_at is not null) then raise exception 'FAIL member purge cascade or historical completion';end if;end $$;
rollback;
