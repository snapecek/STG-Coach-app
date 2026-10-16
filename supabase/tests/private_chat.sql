begin;
insert into auth.users(id) select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,4)n;
insert into clubs(id,name) values('20000000-0000-4000-8000-000000000001','Klub'),('20000000-0000-4000-8000-000000000002','Cizí');
insert into club_roles values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','coach'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','member'),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','coach');
insert into members(id,club_id,user_id,name,kind) select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001',('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Člen '||n,'member' from generate_series(2,3)n;
insert into events(id,club_id,name,starts_at,place,type) values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Událost',now()+interval '2 days','Park','Běh');
insert into chat_messages(club_id,author_name,body) values('20000000-0000-4000-8000-000000000001','Historie','Starý společný obsah');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
select set_config('test.contact2',(select id::text from coach_chat_contacts('20000000-0000-4000-8000-000000000001')),true);
select send_conversation_message('20000000-0000-4000-8000-000000000001',null,current_setting('test.contact2')::uuid,'Soukromá zpráva A');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
select set_config('test.contact3',(select id::text from coach_chat_contacts('20000000-0000-4000-8000-000000000001')),true);
do $$begin
 if (select count(*) from coach_chat_contacts('20000000-0000-4000-8000-000000000001'))<>1 then raise exception 'FAIL other contacts';end if;
 if exists(select 1 from conversation_threads_with_totals('20000000-0000-4000-8000-000000000001')) then raise exception 'FAIL private unread metadata leaked';end if;
 begin perform list_conversation_messages('20000000-0000-4000-8000-000000000001',null,current_setting('test.contact2')::uuid);raise exception 'FAIL private read';exception when insufficient_privilege then null;end;
 begin perform send_conversation_message('20000000-0000-4000-8000-000000000001',null,current_setting('test.contact2')::uuid,'Impersonation');raise exception 'FAIL private send';exception when insufficient_privilege then null;end;
 begin perform list_chat_messages('20000000-0000-4000-8000-000000000001');raise exception 'FAIL legacy archive exposed';exception when insufficient_privilege then null;end;
 begin perform send_chat_message('20000000-0000-4000-8000-000000000001',null,'Broadcast');raise exception 'FAIL legacy shared send';exception when insufficient_privilege then null;end;
end $$;
select send_conversation_message('20000000-0000-4000-8000-000000000001',null,current_setting('test.contact3')::uuid,'Soukromá zpráva B');
select send_chat_message('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Společná událost');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$begin
 if (select count(*) from coach_chat_contacts('20000000-0000-4000-8000-000000000001'))<>2 then raise exception 'FAIL coach contacts';end if;
 if (select count(*) from list_chat_messages('20000000-0000-4000-8000-000000000001'))<>1 then raise exception 'FAIL retained archive';end if;
 if (select count(*) from list_conversation_messages('20000000-0000-4000-8000-000000000001',null,current_setting('test.contact2')::uuid))<>1 then raise exception 'FAIL coach private inbox';end if;
end $$;
select set_config('test.reply',send_conversation_message('20000000-0000-4000-8000-000000000001',null,current_setting('test.contact2')::uuid,'Odpověď trenéra')::text,true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 if not exists(select 1 from conversation_threads('20000000-0000-4000-8000-000000000001') where conversation_id=current_setting('test.contact2')::uuid and unread=1) then raise exception 'FAIL private unread';end if;
 if (select count(*) from list_chat_messages('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001'))<>1 then raise exception 'FAIL shared event chat';end if;
 begin perform mark_conversation_read('20000000-0000-4000-8000-000000000001',null,current_setting('test.contact3')::uuid,current_setting('test.reply')::bigint);raise exception 'FAIL mark other conversation';exception when insufficient_privilege then null;end;
end $$;
do $$begin
 if not exists(select 1 from conversation_threads_with_totals('20000000-0000-4000-8000-000000000001') where conversation_id=current_setting('test.contact2')::uuid and message_count=2 and unread=1) then raise exception 'FAIL total vs unread';end if;
end $$;
select mark_conversation_read('20000000-0000-4000-8000-000000000001',null,current_setting('test.contact2')::uuid,current_setting('test.reply')::bigint);
do $$begin
 if not exists(select 1 from conversation_threads_with_totals('20000000-0000-4000-8000-000000000001') where conversation_id=current_setting('test.contact2')::uuid and message_count=2 and unread=0) then raise exception 'FAIL read changed total';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004"}',true);
do $$begin
 begin perform conversation_threads_with_totals('20000000-0000-4000-8000-000000000001');raise exception 'FAIL cross club counts';exception when insufficient_privilege then null;end;
 begin perform list_conversation_messages('20000000-0000-4000-8000-000000000001',null,current_setting('test.contact2')::uuid);raise exception 'FAIL cross club coach';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into chat_messages(club_id,event_id,author_id,author_name,body)
select '20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Člen 2','Zpráva '||n from generate_series(1,61)n;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 if not exists(select 1 from conversation_threads_with_totals('20000000-0000-4000-8000-000000000001') where event_id='50000000-0000-4000-8000-000000000001' and message_count=62) then raise exception 'FAIL total capped to message page';end if;
end $$;
select delete_chat_message('20000000-0000-4000-8000-000000000001',(select max(id) from list_conversation_messages('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001')));
do $$begin
 if not exists(select 1 from conversation_threads_with_totals('20000000-0000-4000-8000-000000000001') where event_id='50000000-0000-4000-8000-000000000001' and message_count=61) then raise exception 'FAIL deleted message total';end if;
end $$;
rollback;
