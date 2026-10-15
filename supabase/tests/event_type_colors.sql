begin;
insert into auth.users(id,email,email_confirmed_at) values ('10000000-0000-4000-8000-000000000001','coach@example.invalid',now()),('10000000-0000-4000-8000-000000000002','member@example.invalid',now()),('10000000-0000-4000-8000-000000000003','wrong@example.invalid',now());
insert into public.clubs(id,name) values ('20000000-0000-4000-8000-000000000001','Fiktivní tým'),('20000000-0000-4000-8000-000000000002','Cizí tým');
insert into public.club_roles values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','coach');
insert into public.members(id,club_id,name,kind) values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fiktivní člen','guest'),('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Jiný člen','member');
insert into public.events(id,club_id,name,starts_at,place,type,event_kind) values ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Trénink',now()+interval '2 days','Park','Kondice','training'),('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Závod',now()+interval '3 days','Les','OCR','race');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
select set_config('stg.test_invite',(public.issue_club_invitation('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',' MEMBER@example.invalid ')->>'token'),true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
do $$begin
 begin perform public.accept_club_invitation(current_setting('stg.test_invite'));raise exception 'FAIL wrong email accepts';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
 if exists(select 1 from public.club_invitations) then raise exception 'FAIL outsider sees invitations';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
select public.accept_club_invitation(current_setting('stg.test_invite'));
-- Member can read the club palette but cannot change it.
do $$begin
 begin insert into event_type_colors(club_id,event_kind,type_key,color) values ('20000000-0000-4000-8000-000000000001','training','síla','#bba7ed');raise exception 'FAIL member inserts color';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
insert into event_type_colors(club_id,event_kind,type_key,color) values ('20000000-0000-4000-8000-000000000001','training','síla','#bba7ed'),('20000000-0000-4000-8000-000000000001','race','síla','#70b5ff');
-- Every additional swatch can be stored, while the existing race color is preserved.
do $$declare swatch text;begin
 foreach swatch in array array['#c4e86b','#8adcf4','#969fff','#df8cf1','#ff7f9f','#e9ad66','#43d6c5','#e2e8f0'] loop
  update event_type_colors set color=swatch where event_kind='training';
  if (select color from event_type_colors where event_kind='training')<>swatch then raise exception 'FAIL extended palette';end if;
 end loop;
 if (select color from event_type_colors where event_kind='race')<>'#70b5ff' then raise exception 'FAIL existing color changed';end if;
end $$;
update event_type_colors set color='#f3a0cb' where event_kind='training';
do $$begin
 begin insert into event_type_colors(club_id,event_kind,type_key,color) values ('20000000-0000-4000-8000-000000000002','training','síla','#bba7ed');raise exception 'FAIL foreign club write';exception when insufficient_privilege then null;end;
 begin update event_type_colors set club_id='20000000-0000-4000-8000-000000000002';raise exception 'FAIL transfer to foreign club';exception when insufficient_privilege then null;end;
 begin update event_type_colors set color='red';raise exception 'FAIL invalid color';exception when check_violation then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 if (select count(*) from event_type_colors)<>2 then raise exception 'FAIL member palette read';end if;
 update event_type_colors set color='#f6d17c';delete from event_type_colors;
 if (select color from event_type_colors where event_kind='training')<>'#f3a0cb' or (select count(*) from event_type_colors)<>2 then raise exception 'FAIL member changes palette';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
do $$begin if exists(select 1 from event_type_colors) then raise exception 'FAIL outsider sees palette';end if;end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
delete from event_type_colors where event_kind='training';
do $$begin if (select count(*) from event_type_colors)<>1 then raise exception 'FAIL reset removes race color too';end if;end $$;
set local role anon;
do $$begin begin perform 1 from event_type_colors;raise exception 'FAIL anon palette';exception when insufficient_privilege then null;end;end $$;
rollback;
