begin;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into clubs(id,name) values ('20000000-0000-4000-8000-000000000001','Fiktivní cíle'),('20000000-0000-4000-8000-000000000002','Cizí klub');
insert into club_roles values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','coach'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
select save_weekly_goals('20000000-0000-4000-8000-000000000001','[{"training_type":"Běh","target_minutes":150}]');
do $$begin
 if (select target_minutes from club_weekly_goals where training_type='Běh')<>150 then raise exception 'FAIL stored goal';end if;
 begin perform save_weekly_goals('20000000-0000-4000-8000-000000000002','[]');raise exception 'FAIL foreign club';exception when insufficient_privilege then null;end;
 begin perform save_weekly_goals('20000000-0000-4000-8000-000000000001','[{"training_type":"Síla","target_minutes":60},{"training_type":"Běh","target_minutes":0}]');raise exception 'FAIL invalid accepted';exception when check_violation then null;end;
 if (select count(*) from club_weekly_goals)<>1 or (select target_minutes from club_weekly_goals where training_type='Běh')<>150 then raise exception 'FAIL replacement rollback';end if;
 begin perform save_weekly_goals('20000000-0000-4000-8000-000000000001','[{"training_type":"Běh","target_minutes":60},{"training_type":" Běh ","target_minutes":60}]');raise exception 'FAIL duplicate';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 if exists(select 1 from club_weekly_goals) then raise exception 'FAIL member read';end if;
 begin perform save_weekly_goals('20000000-0000-4000-8000-000000000001','[]');raise exception 'FAIL member write';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$begin begin perform 1 from club_weekly_goals;raise exception 'FAIL anon';exception when insufficient_privilege then null;end;end $$;
rollback;
