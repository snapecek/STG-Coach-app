begin;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into clubs(id,name) values ('20000000-0000-4000-8000-000000000001','Test šablon'),('20000000-0000-4000-8000-000000000002','Cizí klub');
insert into club_roles values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','coach'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member');
insert into members(id,club_id,name,kind) values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','První','member'),('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Druhý','member'),('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','Třetí','guest');
insert into events(id,club_id,name,place,type,starts_at,actual_notes) values ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Dokončený trénink','Park','Kondice',now()-interval '2 days','Průběh');
insert into participation(club_id,event_id,member_id,attended) select '20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',id,true from members;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
insert into club_presets(club_id,kind,name,settings) values ('20000000-0000-4000-8000-000000000001','race','Spartan Sprint','{"discipline":"OCR","distance_km":5,"minutes":180}'),('20000000-0000-4000-8000-000000000001','equipment','Kettlebell','{}'),('20000000-0000-4000-8000-000000000001','game','Štafeta','{"scoring":"points","mode":"teams","notes":"Pravidla"}');
do $$begin
 begin insert into club_presets(club_id,kind,name,settings) values ('20000000-0000-4000-8000-000000000002','equipment','Cizí','{}');raise exception 'FAIL foreign preset';exception when insufficient_privilege then null;end;
 begin insert into club_presets(club_id,kind,name,settings) values ('20000000-0000-4000-8000-000000000001','game','Neplatná','{}');raise exception 'FAIL missing scoring';exception when check_violation then null;end;
end $$;
update events set completed_at=now();
select save_team_training_game('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','Štafeta','points','Pravidla','[{"id":"70000000-0000-4000-8000-000000000001","name":"A","member_ids":["30000000-0000-4000-8000-000000000001","30000000-0000-4000-8000-000000000002"]},{"id":"70000000-0000-4000-8000-000000000002","name":"B","member_ids":["30000000-0000-4000-8000-000000000003"]}]',null);
do $$declare rev integer;begin
 if exists(select 1 from events where completed_at is not null) then raise exception 'FAIL unplanned game did not reopen journal';end if;
 select revision into rev from training_games;
 begin perform save_training_game('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','Štafeta','points','',array['30000000-0000-4000-8000-000000000001']::uuid[],rev);raise exception 'FAIL individual bypass';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
 perform set_training_game_team_score('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',rev,'scored',0);
 if (select count(*) from training_game_entries where status='scored' and score=0)<>2 then raise exception 'FAIL shared zero score';end if;
 begin perform set_training_game_team_score('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',rev,'scored',1);raise exception 'FAIL stale revision';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
 select revision into rev from training_games;
 begin perform set_training_game_score('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',rev,'scored',100);raise exception 'FAIL individual score bypass';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
 begin perform save_team_training_game('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','Štafeta','points','','[{"id":"70000000-0000-4000-8000-000000000001","name":"A","member_ids":["30000000-0000-4000-8000-000000000001"]},{"id":"70000000-0000-4000-8000-000000000002","name":"B","member_ids":["30000000-0000-4000-8000-000000000001"]}]',rev);raise exception 'FAIL duplicate player';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
update participation set attended=false where member_id='30000000-0000-4000-8000-000000000002';
do $$declare rev integer;begin
 select revision into rev from training_games;
 begin perform set_training_game_team_score('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',rev,'scored',2);raise exception 'FAIL absent player scored';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
 if (select score from training_game_teams where name='A')<>0 then raise exception 'FAIL partial score write';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 if exists(select 1 from club_presets) or exists(select 1 from training_game_teams) then raise exception 'FAIL member reads staff templates or teams';end if;
 begin perform apply_training_game_score('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1,'scored',3);raise exception 'FAIL private helper';exception when insufficient_privilege then null;end;
end $$;
rollback;
