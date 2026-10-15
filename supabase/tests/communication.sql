begin;
insert into auth.users(id,email,email_confirmed_at) values ('10000000-0000-4000-8000-000000000001','coach@example.invalid',now()),('10000000-0000-4000-8000-000000000002','member@example.invalid',now()),('10000000-0000-4000-8000-000000000003','other@example.invalid',now());
insert into clubs(id,name) values ('20000000-0000-4000-8000-000000000001','Klub'),('20000000-0000-4000-8000-000000000002','Cizí klub');
insert into club_roles values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','coach'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member'),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','owner');
insert into members(id,club_id,user_id,name,kind) values ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Člen','member');
insert into events(id,club_id,name,starts_at,place,type,roster_only,group_name) values ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Otevřený trénink',now(),'Park','Běh',false,''),('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Skupina',now(),'Park','Běh',true,'Skupina');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
select set_config('test.message',send_chat_message('20000000-0000-4000-8000-000000000001',null,'Zpráva trenéra')::text,true);
select send_chat_message('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','Soukromá skupinová domluva');
select submit_app_feedback('20000000-0000-4000-8000-000000000001','idea','Trenérův nápad','Popis');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$declare total bigint;begin
 if (select count(*) from list_chat_messages('20000000-0000-4000-8000-000000000001'))<>1 then raise exception 'FAIL shared club chat';end if;
 if exists(select 1 from chat_threads('20000000-0000-4000-8000-000000000001') where event_id is not null) then raise exception 'FAIL private event metadata leaked';end if;
 if (select unread from chat_threads('20000000-0000-4000-8000-000000000001') where event_id is null)<>1 then raise exception 'FAIL unread count';end if;
 perform mark_chat_read('20000000-0000-4000-8000-000000000001',null,current_setting('test.message')::bigint);
 if (select unread from chat_threads('20000000-0000-4000-8000-000000000001') where event_id is null)<>0 then raise exception 'FAIL seen marker';end if;
 begin perform mark_chat_read('20000000-0000-4000-8000-000000000001',null,99999999);raise exception 'FAIL future read marker';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
 begin perform list_chat_messages('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002');raise exception 'FAIL private event';exception when insufficient_privilege then null;end;
 begin perform send_chat_message('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','Forbidden');raise exception 'FAIL private send';exception when insufficient_privilege then null;end;
 begin perform delete_chat_message('20000000-0000-4000-8000-000000000001',current_setting('test.message')::bigint);raise exception 'FAIL delete someone else';exception when insufficient_privilege then null;end;
 begin perform send_chat_message('20000000-0000-4000-8000-000000000002',null,'Cross club');raise exception 'FAIL cross club send';exception when insufficient_privilege then null;end;
 begin perform * from public.chat_messages;raise exception 'FAIL direct table read';exception when insufficient_privilege then null;end;
 if exists(select 1 from list_app_feedback('20000000-0000-4000-8000-000000000001')) then raise exception 'FAIL other authors feedback';end if;
 begin perform send_chat_message('20000000-0000-4000-8000-000000000001',null,'   ');raise exception 'FAIL empty message';exception when raise_exception then if SQLERRM like 'FAIL%' then raise;end if;end;
end $$;
select set_config('test.own_message',send_chat_message('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Členská domluva')::text,true);
select set_config('test.feedback',submit_app_feedback('20000000-0000-4000-8000-000000000001','bug','Nefunkční tlačítko','Kroky k reprodukci')::text,true);
insert into storage.objects(bucket_id,name) values ('app-feedback','20000000-0000-4000-8000-000000000001/'||current_setting('test.feedback')||'/image');
do $$begin
 if (select count(*) from list_app_feedback('20000000-0000-4000-8000-000000000001') where is_own and has_image)<>1 then raise exception 'FAIL own feedback attachment';end if;
 begin perform update_app_feedback('20000000-0000-4000-8000-000000000001',current_setting('test.feedback')::uuid,'done','Self done');raise exception 'FAIL member changes status';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
do $$begin
 begin perform list_app_feedback('20000000-0000-4000-8000-000000000001');raise exception 'FAIL other club feedback';exception when insufficient_privilege then null;end;
 if exists(select 1 from storage.objects where bucket_id='app-feedback') then raise exception 'FAIL cross club image';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
select update_app_feedback('20000000-0000-4000-8000-000000000001',current_setting('test.feedback')::uuid,'in_progress','Prověřujeme');
do $$begin
 if (select count(*) from list_app_feedback('20000000-0000-4000-8000-000000000001'))<>2 then raise exception 'FAIL staff triage';end if;
 if not exists(select 1 from chat_threads('20000000-0000-4000-8000-000000000001') where event_id='50000000-0000-4000-8000-000000000001' and unread=1) then raise exception 'FAIL read markers shared across users';end if;
 if (select count(*) from storage.objects where bucket_id='app-feedback')<>1 then raise exception 'FAIL staff image read';end if;
 begin insert into storage.objects(bucket_id,name) values ('app-feedback','20000000-0000-4000-8000-000000000001/'||current_setting('test.feedback')||'/image');raise exception 'FAIL staff impersonates attachment author';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into participation(club_id,event_id,member_id) values ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 if (select count(*) from list_chat_messages('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002'))<>1 then raise exception 'FAIL roster access';end if;
 if not exists(select 1 from list_app_feedback('20000000-0000-4000-8000-000000000001') where staff_note='Prověřujeme' and status='in_progress') then raise exception 'FAIL author status';end if;
end $$;
select delete_chat_message('20000000-0000-4000-8000-000000000001',current_setting('test.own_message')::bigint);
do $$declare blocked boolean:=false;n integer;begin
 for n in 1..31 loop
  begin perform send_chat_message('20000000-0000-4000-8000-000000000001',null,'Rate test');exception when raise_exception then if SQLERRM<>'Too many messages' then raise;end if;blocked:=true;exit;end;
 end loop;
 if not blocked then raise exception 'FAIL rate limit';end if;
 if (select count(*) from list_chat_messages('20000000-0000-4000-8000-000000000001'))>50 then raise exception 'FAIL page limit';end if;
end $$;

reset role;
update members set removed_at=now() where id='30000000-0000-4000-8000-000000000002';
set local role authenticated;
do $$begin
 begin perform list_chat_messages('20000000-0000-4000-8000-000000000001');raise exception 'FAIL archived member reads';exception when insufficient_privilege then null;end;
 if exists(select 1 from storage.objects where bucket_id='app-feedback') then raise exception 'FAIL archived member image';end if;
end $$;
rollback;
