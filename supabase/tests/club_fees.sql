begin;
insert into auth.users(id) select ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,5)i;
insert into clubs(id,name) values('20000000-0000-4000-8000-000000000001','Příspěvkový klub'),('20000000-0000-4000-8000-000000000002','Cizí klub');
insert into club_roles values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','member'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','coach'),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000005','owner');
insert into members(id,club_id,user_id,name,kind,event_guest) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Adam Novák','member',false),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','Barbora Černá','member',false),
 ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001',null,'Host Hala','guest',true),
 ('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000002',null,'Cizí člověk','guest',false),
 ('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001',null,'Host bez soupisky','guest',true);
insert into events(id,club_id,name,starts_at,place,type) values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Bazén',now()-interval '1 day','Bazén','Kondice');
insert into participation(club_id,event_id,member_id,attended) values('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003',true);
select set_config('test.fee.club','20000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
do $$begin
 if get_club_fees_enabled(current_setting('test.fee.club')::uuid) then raise exception 'FAIL enabled by default';end if;
 begin perform create_club_fee_plan(current_setting('test.fee.club')::uuid,'Členské','monthly',50000);raise exception 'FAIL disabled write';exception when raise_exception then if sqlerrm<>'Fees disabled' then raise;end if;end;
end $$;
select set_club_fees_enabled(current_setting('test.fee.club')::uuid,true);
select set_config('test.fee.plan',create_club_fee_plan(current_setting('test.fee.club')::uuid,'Členské','monthly',50000)::text,true);
do $$declare n integer;begin
 n:=create_club_fee_charges(current_setting('test.fee.club')::uuid,array['30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002']::uuid[],'membership','ignored',1,current_date,'2026-10-20',current_setting('test.fee.plan')::uuid);
 if n<>2 or exists(select 1 from club_fee_charges where amount_cents<>50000 or period_start<>'2026-10-01') then raise exception 'FAIL amount or monthly period';end if;
 if create_club_fee_charges(current_setting('test.fee.club')::uuid,array['30000000-0000-4000-8000-000000000001']::uuid[],'membership','ignored',1,current_date,'2026-10-01',current_setting('test.fee.plan')::uuid)<>0 then raise exception 'FAIL duplicated recurring charge';end if;
 begin perform create_club_fee_charges(current_setting('test.fee.club')::uuid,array['30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004']::uuid[],'membership','ignored',1,current_date,'2026-11-01',current_setting('test.fee.plan')::uuid);raise exception 'FAIL cross club batch';exception when raise_exception then if sqlerrm<>'Fee member unavailable' then raise;end if;end;
 if exists(select 1 from club_fee_charges where period_start='2026-11-01') then raise exception 'FAIL partial batch committed';end if;
 begin insert into club_fee_charges(club_id,member_name,kind,title,amount_cents,due_date) values(current_setting('test.fee.club')::uuid,'Injected','membership','Bad',1,current_date);raise exception 'FAIL direct insert';exception when insufficient_privilege then null;end;
end $$;
select set_config('test.fee.charge',(select id::text from club_fee_charges where member_name='Adam Novák'),true);
select record_club_fee_payment(current_setting('test.fee.club')::uuid,current_setting('test.fee.charge')::uuid,'60000000-0000-4000-8000-000000000001',12345,current_date,'cash','Část');
-- Idempotent retry, never a duplicate receipt.
select record_club_fee_payment(current_setting('test.fee.club')::uuid,current_setting('test.fee.charge')::uuid,'60000000-0000-4000-8000-000000000001',12345,current_date,'cash','Část');
do $$begin
 if (select count(*) from club_fee_payments)<>1 then raise exception 'FAIL payment retry duplicated';end if;
 begin perform record_club_fee_payment(current_setting('test.fee.club')::uuid,current_setting('test.fee.charge')::uuid,'60000000-0000-4000-8000-000000000002',40000,current_date,'bank');raise exception 'FAIL overpaid';exception when raise_exception then if sqlerrm<>'Fee payment exceeds balance' then raise;end if;end;
 begin perform record_club_fee_payment(current_setting('test.fee.club')::uuid,current_setting('test.fee.charge')::uuid,'60000000-0000-4000-8000-000000000002',1,(now() at time zone 'Europe/Prague')::date+1,'bank');raise exception 'FAIL future receipt';exception when raise_exception then if sqlerrm<>'Invalid fee input' then raise;end if;end;
 begin perform cancel_club_fee_charge(current_setting('test.fee.club')::uuid,current_setting('test.fee.charge')::uuid,'Chyba');raise exception 'FAIL cancelled paid charge';exception when raise_exception then if sqlerrm<>'Fee charge has payments' then raise;end if;end;
end $$;
-- A member sees exactly one person's balances, including their partial receipt.
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$declare j jsonb;begin
 j:=club_fee_ledger(current_setting('test.fee.club')::uuid);
 if jsonb_array_length(j->'charges')<>1 or jsonb_array_length(j->'payments')<>1 or jsonb_array_length(j->'plans')<>0 or j::text like '%Barbora%' or j::text like '%created_by%' then raise exception 'FAIL member RPC privacy';end if;
 if (select count(*) from club_fee_charges)<>1 or (select count(*) from club_fee_payments)<>1 or exists(select 1 from club_fee_plans) then raise exception 'FAIL member RLS privacy';end if;
 begin perform set_club_fees_enabled(current_setting('test.fee.club')::uuid,false);raise exception 'FAIL member toggled';exception when insufficient_privilege then null;end;
 begin perform record_club_fee_payment(current_setting('test.fee.club')::uuid,current_setting('test.fee.charge')::uuid,'60000000-0000-4000-8000-000000000003',1,current_date,'cash');raise exception 'FAIL self confirmed';exception when insufficient_privilege then null;end;
 begin update club_fee_payments set amount_cents=50000;raise exception 'FAIL direct member write';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005"}',true);
do $$begin
 if exists(select 1 from club_fee_charges) or exists(select 1 from club_fee_payments) or exists(select 1 from club_fee_plans) then raise exception 'FAIL tenant isolation';end if;
 begin perform club_fee_ledger(current_setting('test.fee.club')::uuid);raise exception 'FAIL foreign ledger';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004"}',true);
do $$begin
 begin perform set_club_fees_enabled(current_setting('test.fee.club')::uuid,false);raise exception 'FAIL coach toggled';exception when insufficient_privilege then null;end;
 if create_club_fee_charges(current_setting('test.fee.club')::uuid,array['30000000-0000-4000-8000-000000000003']::uuid[],'training','Vstup bazén',8000,current_date,null,null,'50000000-0000-4000-8000-000000000001')<>1 then raise exception 'FAIL guest charge';end if;
 if create_club_fee_charges(current_setting('test.fee.club')::uuid,array['30000000-0000-4000-8000-000000000003']::uuid[],'training','Vstup bazén',8000,current_date,null,null,'50000000-0000-4000-8000-000000000001')<>0 then raise exception 'FAIL duplicate training';end if;
 begin perform create_club_fee_charges(current_setting('test.fee.club')::uuid,array['30000000-0000-4000-8000-000000000005']::uuid[],'training','Vstup bazén',8000,current_date,null,null,'50000000-0000-4000-8000-000000000001');raise exception 'FAIL unrelated guest';exception when raise_exception then if sqlerrm<>'Fee member unavailable' then raise;end if;end;
end $$;
select set_config('test.fee.yearplan',create_club_fee_plan(current_setting('test.fee.club')::uuid,'Roční','yearly',200000)::text,true);
select create_club_fee_charges(current_setting('test.fee.club')::uuid,array['30000000-0000-4000-8000-000000000001']::uuid[],'membership','ignored',1,current_date,'2026-06-15',current_setting('test.fee.yearplan')::uuid);
do $$begin
 if not exists(select 1 from club_fee_charges where plan_id=current_setting('test.fee.yearplan')::uuid and period_start='2026-01-01' and amount_cents=200000) then raise exception 'FAIL annual normalization';end if;
 begin perform create_club_fee_plan(current_setting('test.fee.club')::uuid,'Bad','monthly',0);raise exception 'FAIL zero amount';exception when raise_exception then if sqlerrm<>'Invalid fee input' then raise;end if;end;
end $$;
select void_club_fee_payment(current_setting('test.fee.club')::uuid,'60000000-0000-4000-8000-000000000001','Chybně zapsáno');
select cancel_club_fee_charge(current_setting('test.fee.club')::uuid,current_setting('test.fee.charge')::uuid,'Chybný předpis');
do $$begin
 if (select voided_at from club_fee_payments limit 1) is null or (select cancelled_at from club_fee_charges where id=current_setting('test.fee.charge')::uuid) is null then raise exception 'FAIL history missing';end if;
end $$;
-- Deleting a training must preserve its financial history and place/date snapshot.
delete from events where id='50000000-0000-4000-8000-000000000001';
do $$begin
 if not exists(select 1 from club_fee_charges where kind='training' and event_id is null and event_name='Bazén') then raise exception 'FAIL event deletion lost charge';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
update members set removed_at=now() where id='30000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 if jsonb_array_length(club_fee_ledger(current_setting('test.fee.club')::uuid)->'charges')<>0 or exists(select 1 from club_fee_payments) then raise exception 'FAIL former member financial access';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
update members set removed_at=null where id='30000000-0000-4000-8000-000000000001';
select set_club_fees_enabled(current_setting('test.fee.club')::uuid,false);
do $$begin
 if exists(select 1 from club_fee_charges) then raise exception 'FAIL disabled data exposure';end if;
end $$;
select set_club_fees_enabled(current_setting('test.fee.club')::uuid,true);
do $$declare backup jsonb;begin
 backup:=export_club_backup(current_setting('test.fee.club')::uuid);
 if jsonb_array_length(backup->'tables'->'club_fee_charges')<>4 or jsonb_array_length(backup->'tables'->'club_fee_payments')<>1 then raise exception 'FAIL financial backup';end if;
end $$;
select archive_club(current_setting('test.fee.club')::uuid,'Příspěvkový klub');
do $$begin
 begin perform create_club_fee_plan(current_setting('test.fee.club')::uuid,'Forbidden','monthly',100);raise exception 'FAIL archived write';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin
 if (select jsonb_array_length(snapshot->'tables'->'club_fee_charges') from club_archives where club_id=current_setting('test.fee.club')::uuid)<>4 then raise exception 'FAIL archive fees';end if;
end $$;
rollback;
