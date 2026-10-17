begin;
insert into auth.users(id) select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,3)n;
insert into clubs(id,name) values('20000000-0000-4000-8000-000000000001','Mapový klub'),('20000000-0000-4000-8000-000000000002','Cizí klub');
insert into club_roles values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member'),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','owner');
insert into members(id,club_id,user_id,name,kind) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Člen','member');
insert into training_groups(id,club_id,name) values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Mapová skupina');
insert into training_group_members values('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');
select set_config('stg.map','{"point":{"lat":49.854,"lng":18.542},"arrows":[{"from":{"lat":49.853,"lng":18.541},"to":{"lat":49.854,"lng":18.542}}],"note":"Zadní brankou"}',true);
select set_config('stg.session',jsonb_build_object('id','50000000-0000-4000-8000-000000000001','name','Mapa','place','Park','type','Běh','plan','Rozcvičení','starts_at',now()+interval '2 days','duration_minutes',60,'event_location',current_setting('stg.map')::jsonb)::text,true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
select id from create_training_series('20000000-0000-4000-8000-000000000001',jsonb_build_array(current_setting('stg.session')::jsonb));
select id from create_group_trainings('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_set(current_setting('stg.session')::jsonb,'{id}','"50000000-0000-4000-8000-000000000002"')));
select (create_club_race('20000000-0000-4000-8000-000000000001',jsonb_set(current_setting('stg.session')::jsonb,'{id}','"50000000-0000-4000-8000-000000000003"'),'{}'::uuid[])).id;
do $$declare bad jsonb;begin
 if (select count(*) from events where event_location=current_setting('stg.map')::jsonb)<>3 then raise exception 'FAIL map lost in creation RPC';end if;
 for bad in select value from jsonb_array_elements('[null,{}, {"point":{"lat":99,"lng":18},"arrows":[],"note":""},{"point":{"lat":49,"lng":18},"arrows":[{"from":{"lat":1,"lng":2},"to":{"lat":1,"lng":2}}],"note":""}]') loop
  begin update events set event_location=bad;raise exception 'FAIL invalid map allowed';exception when check_violation then null;end;
 end loop;
 begin update events set event_location=jsonb_set(current_setting('stg.map')::jsonb,'{note}',to_jsonb(repeat('x',501)));raise exception 'FAIL long note';exception when check_violation then null;end;
 begin update events set event_location=jsonb_set(current_setting('stg.map')::jsonb,'{arrows}',(select jsonb_agg(current_setting('stg.map')::jsonb->'arrows'->0) from generate_series(1,9)));raise exception 'FAIL too many arrows';exception when check_violation then null;end;
 begin perform create_training_series('20000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_set(current_setting('stg.session')::jsonb,'{id}','"50000000-0000-4000-8000-000000000009"'),jsonb_set(jsonb_set(current_setting('stg.session')::jsonb,'{id}','"50000000-0000-4000-8000-000000000010"'),'{event_location}','{}')));raise exception 'FAIL invalid series allowed';exception when check_violation then null;end;
 if exists(select 1 from events where id='50000000-0000-4000-8000-000000000009') then raise exception 'FAIL partial map series';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$declare n integer;begin
 if (select count(*) from events where event_location=current_setting('stg.map')::jsonb)<>3 then raise exception 'FAIL member map unavailable';end if;
 update events set event_location=null;get diagnostics n=row_count;if n<>0 then raise exception 'FAIL member changed map';end if;
 begin perform create_training_series('20000000-0000-4000-8000-000000000001',jsonb_build_array(current_setting('stg.session')::jsonb));raise exception 'FAIL member created map event';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
do $$begin if exists(select 1 from events where club_id='20000000-0000-4000-8000-000000000001') then raise exception 'FAIL foreign map exposed';end if;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
update events set event_location=jsonb_set(event_location,'{note}','"Od parkoviště"') where id='50000000-0000-4000-8000-000000000001';
do $$begin if (select event_location->>'note' from events where id='50000000-0000-4000-8000-000000000001')<>'Od parkoviště' then raise exception 'FAIL map edit';end if;end $$;
update events set event_location=null where id='50000000-0000-4000-8000-000000000001';
do $$begin if (select event_location from events where id='50000000-0000-4000-8000-000000000001') is not null then raise exception 'FAIL map removal';end if;end $$;
rollback;
