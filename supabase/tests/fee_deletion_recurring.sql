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
do $$declare n integer;begin
 n:=set_club_fee_recurrence(current_setting('test.fee.club')::uuid,current_setting('test.fee.plan')::uuid,true,array['30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002']::uuid[],current_setting('test.fee.month')::date,31);
 if n<>2 or (select count(*) from club_fee_plan_members)<>2 then raise exception 'FAIL current month creation';end if;
 if set_club_fee_recurrence(current_setting('test.fee.club')::uuid,current_setting('test.fee.plan')::uuid,true,array['30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002']::uuid[],current_setting('test.fee.month')::date,31)<>0 then raise exception 'FAIL duplicate setup';end if;
 begin perform set_club_fee_recurrence(current_setting('test.fee.club')::uuid,current_setting('test.fee.year')::uuid,true,array['30000000-0000-4000-8000-000000000001']::uuid[],current_setting('test.fee.month')::date,31);raise exception 'FAIL yearly auto';exception when raise_exception then if sqlerrm<>'Invalid fee input' then raise;end if;end;
 begin perform set_club_fee_recurrence(current_setting('test.fee.club')::uuid,current_setting('test.fee.plan')::uuid,true,array['30000000-0000-4000-8000-000000000003']::uuid[],current_setting('test.fee.month')::date,31);raise exception 'FAIL foreign assignment';exception when raise_exception then if sqlerrm<>'Fee member unavailable' then raise;end if;end;
 if (select count(*) from club_fee_plan_members)<>2 then raise exception 'FAIL invalid batch lost selection';end if;
end $$;
select set_config('test.fee.delete',(select id::text from club_fee_charges where member_name='Adam Novák'),true);
select set_config('test.fee.paid',(select id::text from club_fee_charges where member_name='Barbora Černá'),true);
select record_club_fee_payment(current_setting('test.fee.club')::uuid,current_setting('test.fee.paid')::uuid,'60000000-0000-4000-8000-000000000001',10000,current_date,'cash');
do $$begin
 begin perform delete_club_fee_charge(current_setting('test.fee.club')::uuid,current_setting('test.fee.paid')::uuid);raise exception 'FAIL paid deletion';exception when raise_exception then if sqlerrm<>'Fee charge has payments' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002"}',true);
do $$begin
 if exists(select 1 from club_fee_plan_members) then raise exception 'FAIL assignment privacy';end if;
 begin perform delete_club_fee_plan(current_setting('test.fee.club')::uuid,current_setting('test.fee.plan')::uuid);raise exception 'FAIL member deleted plan';exception when insufficient_privilege then null;end;
 begin perform delete_club_fee_charge(current_setting('test.fee.club')::uuid,current_setting('test.fee.delete')::uuid);raise exception 'FAIL member deleted charge';exception when insufficient_privilege then null;end;
 begin perform set_club_fee_recurrence(current_setting('test.fee.club')::uuid,current_setting('test.fee.plan')::uuid,false,null,null,null);raise exception 'FAIL member changed schedule';exception when insufficient_privilege then null;end;
 begin perform run_club_fee_recurring();raise exception 'FAIL client ran scheduler';exception when insufficient_privilege then null;end;
 begin perform generate_club_fee_months(current_setting('test.fee.club')::uuid,'2028-02-01');raise exception 'FAIL client injected future';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004"}',true);
do $$begin
 begin perform delete_club_fee_plan(current_setting('test.fee.club')::uuid,current_setting('test.fee.plan')::uuid);raise exception 'FAIL foreign deletion';exception when insufficient_privilege then null;end;
 begin perform set_club_fee_recurrence(current_setting('test.fee.club')::uuid,current_setting('test.fee.plan')::uuid,false,null,null,null);raise exception 'FAIL foreign pause';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003"}',true);
select delete_club_fee_charge(current_setting('test.fee.club')::uuid,current_setting('test.fee.delete')::uuid);
do $$begin
 if exists(select 1 from jsonb_array_elements(club_fee_ledger(current_setting('test.fee.club')::uuid)->'charges') c where c->>'id'=current_setting('test.fee.delete')) then raise exception 'FAIL deleted charge visible';end if;
 begin perform record_club_fee_payment(current_setting('test.fee.club')::uuid,current_setting('test.fee.delete')::uuid,'60000000-0000-4000-8000-000000000002',1,current_date,'cash');raise exception 'FAIL deleted charge paid';exception when raise_exception then if sqlerrm<>'Fee record unavailable' then raise;end if;end;
end $$;
reset role;
update club_fee_plans set auto_next_month=current_setting('test.fee.month')::date where id=current_setting('test.fee.plan')::uuid;
select generate_club_fee_months(current_setting('test.fee.club')::uuid,current_setting('test.fee.month')::date);
do $$begin
 if (select count(*) from club_fee_charges)<>2 or (select count(*) from club_fee_charges where deleted_at is not null)<>1 then raise exception 'FAIL deleted month resurrected';end if;
end $$;
-- A missed worker run catches up; leap February and short months clamp day 31.
select generate_club_fee_months(current_setting('test.fee.club')::uuid,'2028-02-01');
do $$begin
 if (select count(*) from club_fee_charges where period_start='2028-02-01' and due_date='2028-02-29' and is_automatic)<>2 then raise exception 'FAIL February clamp';end if;
 if (select count(*) from club_fee_charges where period_start='2027-04-01' and due_date='2027-04-30')<>2 then raise exception 'FAIL April clamp';end if;
 if generate_club_fee_months(current_setting('test.fee.club')::uuid,'2028-02-01')<>0 then raise exception 'FAIL worker retry duplicate';end if;
end $$;
-- Removed people stop accruing even while still assigned to a rate.
update members set removed_at=now() where id='30000000-0000-4000-8000-000000000002';
select generate_club_fee_months(current_setting('test.fee.club')::uuid,'2028-03-01');
do $$begin if (select count(*) from club_fee_charges where period_start='2028-03-01')<>1 then raise exception 'FAIL archived member billed';end if;end $$;
-- Feature disable/restore skips disabled months rather than accumulating debt.
update club_fee_plans set auto_next_month=(current_setting('test.fee.month')::date-interval '3 months')::date where id=current_setting('test.fee.plan')::uuid;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001"}',true);
select set_club_fees_enabled(current_setting('test.fee.club')::uuid,false);
reset role;
do $$begin if run_club_fee_recurring()<>0 then raise exception 'FAIL disabled billing';end if;end $$;
set local role authenticated;
select set_club_fees_enabled(current_setting('test.fee.club')::uuid,true);
do $$begin if (select auto_next_month from club_fee_plans where id=current_setting('test.fee.plan')::uuid)<>current_setting('test.fee.month')::date then raise exception 'FAIL disabled months debt';end if;end $$;
-- Archive pauses generation and restore skips the archived interval.
reset role;
update club_fee_plans set auto_next_month=(current_setting('test.fee.month')::date-interval '3 months')::date where id=current_setting('test.fee.plan')::uuid;
set local role authenticated;
select archive_club(current_setting('test.fee.club')::uuid,'Měsíční klub');
reset role;
select set_config('test.fee.archive',(select id::text from club_archives where club_id=current_setting('test.fee.club')::uuid order by created_at desc limit 1),true);
do $$begin if run_club_fee_recurring()<>0 then raise exception 'FAIL archived club billing';end if;end $$;
set local role authenticated;
select restore_archived_club(current_setting('test.fee.archive')::uuid);
do $$begin if (select auto_next_month from club_fee_plans where id=current_setting('test.fee.plan')::uuid)<>current_setting('test.fee.month')::date then raise exception 'FAIL restored club backdated debt';end if;end $$;
-- Deleting the rate pauses it, hides it, and leaves all issued history intact.
select delete_club_fee_plan(current_setting('test.fee.club')::uuid,current_setting('test.fee.plan')::uuid);
do $$declare j jsonb;begin
 j:=club_fee_ledger(current_setting('test.fee.club')::uuid);
 if exists(select 1 from jsonb_array_elements(j->'plans') p where p->>'id'=current_setting('test.fee.plan')) then raise exception 'FAIL deleted plan visible';end if;
 if jsonb_array_length(j->'payments')<>1 then raise exception 'FAIL deletion lost payment';end if;
 if not exists(select 1 from jsonb_array_elements(export_club_backup(current_setting('test.fee.club')::uuid)->'tables'->'club_fee_charges') c where c->>'deleted_at' is not null) then raise exception 'FAIL audit tombstone missing';end if;
end $$;
reset role;
do $$begin if run_club_fee_recurring()<>0 then raise exception 'FAIL deleted plan recurring';end if;end $$;
-- Verify scheduler readiness without installing a scheduler in disposable Postgres.
create schema cron;
create table cron.job(jobname text,active boolean,command text,schedule text);
insert into cron.job values('trenomi-monthly-club-fees',true,'select public.run_club_fee_recurring();','0 * * * *');
do $$begin if not club_fee_cron_ready() then raise exception 'FAIL scheduler readiness';end if;end $$;
update cron.job set active=false;
do $$begin if club_fee_cron_ready() then raise exception 'FAIL inactive scheduler';end if;end $$;
rollback;
