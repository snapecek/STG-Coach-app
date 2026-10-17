begin;
insert into auth.users(id) values('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002'),('10000000-0000-4000-8000-000000000003'),('10000000-0000-4000-8000-000000000004');
insert into clubs(id,name) values('20000000-0000-4000-8000-000000000001','Mapový klub'),('20000000-0000-4000-8000-000000000002','Cizí klub');
insert into club_roles values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member'),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','coach');
select set_config('stg.map','{"point":{"lat":49.854,"lng":18.542},"arrows":[{"from":{"lat":49.853,"lng":18.541},"to":{"lat":49.854,"lng":18.542}}],"note":"Zadní brankou"}',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004"}',true);
insert into club_locations(id,club_id,name,event_location) values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Judo hala',current_setting('stg.map')::jsonb);
insert into templates(id,club_id,name,type,place,minutes,plan,event_location) select '50000000-0000-4000-8000-000000000001',club_id,'Judo','Síla',name,60,'Rozcvičení',event_location from club_locations;
insert into club_presets(id,club_id,kind,name,settings) values('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','race','Závod',jsonb_build_object('discipline','OCR','minutes',180,'event_location',current_setting('stg.map')::jsonb));
do $$begin
 begin insert into club_locations(club_id,name,event_location) values('20000000-0000-4000-8000-000000000001',' judo hala ',current_setting('stg.map')::jsonb);raise exception 'FAIL duplicate';exception when unique_violation then null;end;
 begin update club_locations set event_location='{}';raise exception 'FAIL invalid location';exception when check_violation then null;end;
 begin update club_locations set event_location='null';raise exception 'FAIL null JSON';exception when check_violation then null;end;
 begin update templates set event_location='{}';raise exception 'FAIL invalid template map';exception when check_violation then null;end;
 begin update club_presets set settings=jsonb_set(settings,'{event_location}','{}');raise exception 'FAIL invalid race map';exception when check_violation then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$declare n integer;begin
 if exists(select 1 from club_locations) then raise exception 'FAIL member library access';end if;
 begin insert into club_locations(club_id,name,event_location) values('20000000-0000-4000-8000-000000000001','Bad',current_setting('stg.map')::jsonb);raise exception 'FAIL member insert';exception when insufficient_privilege then null;end;
 update club_locations set name='Bad';get diagnostics n=row_count;if n<>0 then raise exception 'FAIL member edit';end if;
 delete from club_locations;get diagnostics n=row_count;if n<>0 then raise exception 'FAIL member delete';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
do $$begin
 if exists(select 1 from club_locations) then raise exception 'FAIL foreign read';end if;
 begin insert into club_locations(club_id,name,event_location) values('20000000-0000-4000-8000-000000000001','Bad',current_setting('stg.map')::jsonb);raise exception 'FAIL foreign insert';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
-- Deleting/replacing a reusable place must never cascade into old map snapshots.
update club_locations set event_location=jsonb_set(event_location,'{note}','"Nová cesta"');
delete from club_locations;
do $$begin
 if (select event_location from templates where id='50000000-0000-4000-8000-000000000001') is distinct from current_setting('stg.map')::jsonb then raise exception 'FAIL template snapshot changed';end if;
 if (select settings->'event_location' from club_presets where id='60000000-0000-4000-8000-000000000001') is distinct from current_setting('stg.map')::jsonb then raise exception 'FAIL race snapshot changed';end if;
end $$;
insert into club_locations(club_id,name,event_location) values('20000000-0000-4000-8000-000000000001','Workout Dubina',current_setting('stg.map')::jsonb);
do $$begin
 if jsonb_array_length(export_club_backup('20000000-0000-4000-8000-000000000001')->'tables'->'club_locations')<>1 then raise exception 'FAIL backup omitted locations';end if;
end $$;
select archive_club('20000000-0000-4000-8000-000000000001','Mapový klub');
reset role;
do $$begin
 if (select jsonb_array_length(snapshot->'tables'->'club_locations') from club_archives where club_id='20000000-0000-4000-8000-000000000001')<>1 then raise exception 'FAIL archive omitted locations';end if;
end $$;
set local role authenticated;
do $$begin
 begin insert into club_locations(club_id,name,event_location) values('20000000-0000-4000-8000-000000000001','Bad archived',current_setting('stg.map')::jsonb);raise exception 'FAIL archived insert';exception when insufficient_privilege then null;when raise_exception then if sqlerrm<>'Club archived' then raise;end if;end;
end $$;
rollback;
