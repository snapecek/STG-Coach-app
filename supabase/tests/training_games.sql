begin;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into clubs(id,name) values ('20000000-0000-4000-8000-000000000001','Fiktivní deník'),('20000000-0000-4000-8000-000000000002','Cizí klub');
insert into club_roles values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','coach'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member');
insert into members(id,club_id,name,kind) values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fiktivní člen','member');
insert into members(id,club_id,name,kind) values ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Fiktivní mimo soupisku','guest'),('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','Cizí člen','guest');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
insert into events(id,club_id,name,place,type,plan,starts_at,duration_minutes,event_kind,actual_notes,actual_distance_km,roster_only,group_name) values ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fiktivní běh','Park','Běh','Plán',now()-interval '2 days',60,'training','Skutečný průběh',11.2,true,'Fiktivní soupiska');
insert into participation(club_id,event_id,member_id,attended) values ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',true);
update events set completed_at=now() where id='50000000-0000-4000-8000-000000000001';
do $$begin if not exists(select 1 from events where completed_at is not null) then raise exception 'FAIL completion';end if;end $$;
select save_training_game('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','Fiktivní dřepy','repetitions','Maximum za minutu',array['30000000-0000-4000-8000-000000000001']::uuid[]);
do $$declare r integer;begin
 select revision into r from training_games where id='90000000-0000-4000-8000-000000000001';
 begin perform set_training_game_score('20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',r,'scored',1.5);raise exception 'FAIL fractional repetitions';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;end;
 perform set_training_game_score('20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',r,'scored',0);
 begin perform set_training_game_score('20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',r,'scored',1);raise exception 'FAIL stale score';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;end;
end $$;
do $$begin
 begin perform save_training_game('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','Neoprávněná hra','points','',array['30000000-0000-4000-8000-000000000002']::uuid[]);raise exception 'FAIL uninvited selected roster';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;end;
 begin perform save_training_game('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','Cizí hra','points','',array['30000000-0000-4000-8000-000000000003']::uuid[]);raise exception 'FAIL foreign member';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;end;
 if (select count(*) from training_games)<>1 then raise exception 'FAIL failed save changed data';end if;
end $$;

do $$begin if not exists(select 1 from training_game_entries where score=0 and status='scored') then raise exception 'FAIL zero is lost';end if;end $$;
update events set completed_at=now();
do $$declare r integer;begin select revision into r from training_games where id='90000000-0000-4000-8000-000000000001';perform set_training_game_score('20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',r,'scored',42);end $$;
do $$begin if exists(select 1 from events where completed_at is not null) then raise exception 'FAIL score did not reopen review';end if;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 if exists(select 1 from training_games) or exists(select 1 from training_game_entries) then raise exception 'FAIL member read';end if;
 begin perform delete_training_game('20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001',1);raise exception 'FAIL member delete';exception when insufficient_privilege then null;end;
 begin update training_game_entries set score=999;raise exception 'FAIL direct write';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
update participation set attended=false;
do $$declare r integer;begin select revision into r from training_games where id='90000000-0000-4000-8000-000000000001';
 begin perform set_training_game_score('20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',r,'scored',12);raise exception 'FAIL absent scored';exception when raise_exception then if sqlerrm like 'FAIL%' then raise;end if;end;
 perform set_training_game_score('20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',r,'dns',null);
end $$;
update events set completed_at=now();
reset role;
delete from members where id='30000000-0000-4000-8000-000000000001';
do $$begin if not exists(select 1 from events where completed_at is not null) then raise exception 'FAIL retention reopened event';end if;if exists(select 1 from training_game_entries) then raise exception 'FAIL retention kept personal score';end if;end $$;
rollback;
