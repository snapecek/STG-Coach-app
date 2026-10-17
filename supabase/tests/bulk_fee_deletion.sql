begin;
insert into auth.users(id) select ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,4)i;
insert into clubs(id,name) values('20000000-0000-4000-8000-000000000001','Měsíční klub'),('20000000-0000-4000-8000-000000000002','Jiný klub');
insert into club_roles values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member'),('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','coach'),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','owner');
insert into members(id,club_id,user_id,name,kind,joined_at) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Adam Novák','member','2020-01-01'),('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',null,'Barbora Černá','member','2020-01-01'),('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002',null,'Cizí člen','member','2020-01-01');
select set_config('test.fee.club','20000000-0000-4000-8000-000000000001',true);
select set_config('test.fee.month',date_trunc('month',now() at time zone 'Europe/Prague')::date::text,true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
select set_club_fees_enabled(current_setting('test.fee.club')::uuid,true);
select set_config('test.fee.plan',create_club_fee_plan(current_setting('test.fee.club')::uuid,'Měsíční','monthly',50000)::text,true);
select set_config('test.fee.year',create_club_fee_plan(current_setting('test.fee.club')::uuid,'Roční','yearly',50000)::text,true);
select create_club_fee_charges(current_setting('test.fee.club')::uuid,array['30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002']::uuid[],'membership','',null,current_date,current_setting('test.fee.month')::date,current_setting('test.fee.plan')::uuid,null);
select set_config('test.bulk.first',(select id::text from club_fee_charges where member_name='Adam Novák'),true);
select set_config('test.bulk.second',(select id::text from club_fee_charges where member_name='Barbora Černá'),true);
select record_club_fee_payment(current_setting('test.fee.club')::uuid,current_setting('test.bulk.second')::uuid,'60000000-0000-4000-8000-000000000001',100,current_date,'cash');
do $$begin
 begin perform delete_club_fee_charges(current_setting('test.fee.club')::uuid,array[current_setting('test.bulk.first')::uuid,current_setting('test.bulk.second')::uuid]);raise exception 'FAIL paid batch';exception when raise_exception then if sqlerrm<>'Fee charge has payments' then raise;end if;end;
 if exists(select 1 from club_fee_charges where deleted_at is not null) then raise exception 'FAIL partial deletion';end if;
 begin perform delete_club_fee_charges(current_setting('test.fee.club')::uuid,array[current_setting('test.bulk.first')::uuid,'99999999-0000-4000-8000-000000000001']);raise exception 'FAIL missing batch';exception when raise_exception then if sqlerrm<>'Fee record unavailable' then raise;end if;end;
 begin perform delete_club_fee_charges(current_setting('test.fee.club')::uuid,array[]::uuid[]);raise exception 'FAIL empty batch';exception when raise_exception then if sqlerrm<>'Invalid fee input' then raise;end if;end;
 begin perform delete_club_fee_charges(current_setting('test.fee.club')::uuid,array[null]::uuid[]);raise exception 'FAIL null batch';exception when raise_exception then if sqlerrm<>'Invalid fee input' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 begin perform delete_club_fee_charges(current_setting('test.fee.club')::uuid,array[current_setting('test.bulk.first')::uuid]);raise exception 'FAIL member batch';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004"}',true);
do $$begin
 begin perform delete_club_fee_charges(current_setting('test.fee.club')::uuid,array[current_setting('test.bulk.first')::uuid]);raise exception 'FAIL foreign batch';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
select void_club_fee_payment(current_setting('test.fee.club')::uuid,'60000000-0000-4000-8000-000000000001','Chybný testovací zápis');
do $$declare n integer;begin
 n:=delete_club_fee_charges(current_setting('test.fee.club')::uuid,array[current_setting('test.bulk.first')::uuid,current_setting('test.bulk.second')::uuid,current_setting('test.bulk.first')::uuid]);
 if n<>2 then raise exception 'FAIL duplicate IDs';end if;
 if jsonb_array_length(club_fee_ledger(current_setting('test.fee.club')::uuid)->'charges')<>0 then raise exception 'FAIL deleted ledger';end if;
end $$;
reset role;
do $$begin
 if (select count(*) from club_fee_charges where deleted_at is not null and cancelled_at is not null and deleted_by='10000000-0000-4000-8000-000000000003')<>2 then raise exception 'FAIL tombstones';end if;
 if (select count(*) from club_fee_payments)<>1 then raise exception 'FAIL receipt history lost';end if;
end $$;
rollback;
