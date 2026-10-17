-- Confirmed deletion with retained audit history, plus opt-in monthly billing.
begin;
alter table public.club_fee_plans
 add column deleted_at timestamptz,add column deleted_by uuid references auth.users on delete set null,
 add column auto_monthly boolean not null default false,
 add column auto_next_month date,add column auto_due_day integer not null default 15 check(auto_due_day between 1 and 31),
 add column auto_updated_at timestamptz,add column auto_updated_by uuid references auth.users on delete set null,
 add constraint fee_monthly_only check(not auto_monthly or (frequency='monthly' and auto_next_month is not null and auto_next_month=date_trunc('month',auto_next_month)::date));
alter table public.club_fee_charges add column deleted_at timestamptz,add column deleted_by uuid references auth.users on delete set null,add column is_automatic boolean not null default false;
create table public.club_fee_plan_members(
 club_id uuid not null references public.clubs on delete cascade,
 plan_id uuid not null references public.club_fee_plans on delete cascade,
 member_id uuid not null references public.members on delete cascade,
 primary key(plan_id,member_id)
);
alter table public.club_fee_plan_members enable row level security;
revoke all on public.club_fee_plan_members from public,anon,authenticated;
grant select on public.club_fee_plan_members to authenticated;
create policy fee_plan_members_read on public.club_fee_plan_members for select to authenticated using(public.can_read_club_fee(club_id,null));
create trigger club_archive_write_guard before insert or update or delete on public.club_fee_plan_members for each row execute function public.guard_active_club_data();
create function public.delete_club_fee_plan(target_club uuid,target_plan uuid) returns void language plpgsql security definer set search_path=public as $$begin
 perform public.require_fee_staff(target_club);
 update club_fee_plans set deleted_at=now(),deleted_by=auth.uid(),archived_at=coalesce(archived_at,now()),auto_monthly=false where club_id=target_club and id=target_plan and deleted_at is null;
 if not found then raise exception 'Fee record unavailable';end if;
end $$;
create function public.delete_club_fee_charge(target_club uuid,target_charge uuid) returns void language plpgsql security definer set search_path=public as $$declare c club_fee_charges;begin
 perform public.require_fee_staff(target_club);
 select * into c from club_fee_charges where club_id=target_club and id=target_charge and deleted_at is null for update;
 if not found then raise exception 'Fee record unavailable';end if;
 if exists(select 1 from club_fee_payments where charge_id=c.id and voided_at is null) then raise exception 'Fee charge has payments';end if;
 -- Keep a tombstone so neither cron nor a retry recreates a deleted obligation.
 update club_fee_charges set deleted_at=now(),deleted_by=auth.uid(),cancelled_at=coalesce(cancelled_at,now()),cancelled_by=coalesce(cancelled_by,auth.uid()),cancel_reason=case when cancel_reason='' then 'Smazaný předpis' else cancel_reason end where id=c.id;
end $$;
-- Internal worker has no public/client execution grant. The explicit month is
-- injectable only by database-owner tests, never by the browser or scheduler.
create function public.generate_club_fee_months(target_club uuid,through_month date) returns integer language plpgsql security definer set search_path=public as $$
declare p club_fee_plans;period_value date;due_value date;month_end date;n integer;total integer:=0;begin
 perform pg_advisory_xact_lock(hashtextextended('club-state:'||target_club::text,0));
 if through_month is null or through_month<>date_trunc('month',through_month)::date or through_month not between date '2000-01-01' and date '2200-12-01' then raise exception 'Invalid fee input';end if;
 if not exists(select 1 from clubs c join club_fee_settings s on s.club_id=c.id where c.id=target_club and c.archived_at is null and s.enabled) then return 0;end if;
 for p in select * from club_fee_plans where club_id=target_club and auto_monthly and archived_at is null and deleted_at is null and auto_next_month<=through_month order by id for update loop
  period_value:=p.auto_next_month;
  while period_value<=through_month loop
   month_end:=(period_value+interval '1 month -1 day')::date;
   due_value:=period_value+(least(p.auto_due_day,extract(day from month_end)::integer)-1);
   insert into club_fee_charges(club_id,member_id,member_name,kind,title,amount_cents,due_date,plan_id,period_start,is_automatic)
   select target_club,m.id,m.name,'membership',p.name||' · '||to_char(period_value,'MM/YYYY'),p.amount_cents,due_value,p.id,period_value,true
   from club_fee_plan_members a join members m on m.id=a.member_id and m.club_id=a.club_id
   where a.club_id=target_club and a.plan_id=p.id and m.kind='member' and m.removed_at is null and (m.purge_after is null or m.purge_after>now())
   and (m.joined_at is null or (m.joined_at at time zone 'Europe/Prague')::date<=month_end)
   and not exists(select 1 from club_fee_charges c where c.club_id=target_club and c.member_id=m.id and c.plan_id=p.id and c.period_start=period_value)
   on conflict do nothing;
   get diagnostics n=row_count;total:=total+n;period_value:=(period_value+interval '1 month')::date;
  end loop;
  update club_fee_plans set auto_next_month=period_value where id=p.id;
 end loop;
 return total;
end $$;
revoke all on function public.generate_club_fee_months(uuid,date) from public,anon,authenticated;
create function public.set_club_fee_recurrence(target_club uuid,target_plan uuid,enabled boolean,member_ids uuid[],start_month date,due_day integer) returns integer language plpgsql security definer set search_path=public as $$
declare p club_fee_plans;this_month date:=date_trunc('month',now() at time zone 'Europe/Prague')::date;next_value date;begin
 perform public.require_fee_staff(target_club);
 select * into p from club_fee_plans where club_id=target_club and id=target_plan and archived_at is null and deleted_at is null for update;
 if not found then raise exception 'Fee record unavailable';end if;
 if enabled is null or p.frequency<>'monthly' then raise exception 'Invalid fee input';end if;
 if not enabled then
  update club_fee_plans set auto_monthly=false,auto_updated_at=now(),auto_updated_by=auth.uid() where id=p.id;return 0;
 end if;
 if start_month is null or start_month<>date_trunc('month',start_month)::date or start_month<this_month or start_month>date '2200-12-01' or due_day is null or due_day not between 1 and 31 or member_ids is null or cardinality(member_ids) not between 1 and 1000 or array_position(member_ids,null) is not null then raise exception 'Invalid fee input';end if;
 if (select count(*) from members where club_id=target_club and id=any(member_ids) and kind='member' and removed_at is null and (purge_after is null or purge_after>now()))<>(select count(distinct id) from unnest(member_ids) id) then raise exception 'Fee member unavailable';end if;
 -- Editing the selection never rewinds already-processed periods; resuming skips
 -- paused months. The UI shows the next unprocessed month explicitly.
 next_value:=greatest(start_month,this_month,coalesce(p.auto_next_month,start_month));
 delete from club_fee_plan_members where club_id=target_club and plan_id=p.id;
 insert into club_fee_plan_members(club_id,plan_id,member_id) select target_club,p.id,id from (select distinct unnest(member_ids) id) selected;
 update club_fee_plans set auto_monthly=true,auto_next_month=next_value,auto_due_day=due_day,auto_updated_at=now(),auto_updated_by=auth.uid() where id=p.id;
 return public.generate_club_fee_months(target_club,this_month);
end $$;
-- Disabling the feature or archiving a club must not accumulate hidden debts.
create function public.resume_fee_months() returns trigger language plpgsql security definer set search_path=public as $$declare target uuid;begin
 if tg_table_name='clubs' then target:=new.id;else target:=new.club_id;end if;
 update club_fee_plans set auto_next_month=greatest(auto_next_month,date_trunc('month',now() at time zone 'Europe/Prague')::date)
 where club_id=target and auto_monthly;
 return new;
end $$;
revoke all on function public.resume_fee_months() from public,anon,authenticated;
create trigger resume_fee_settings after update of enabled on public.club_fee_settings for each row when(new.enabled and not old.enabled) execute function public.resume_fee_months();
create trigger resume_fee_club after update of archived_at on public.clubs for each row when(new.archived_at is null and old.archived_at is not null) execute function public.resume_fee_months();
-- Archiving a rate also pauses it. Existing archive RPC remains compatible.
create or replace function public.archive_club_fee_plan(target_club uuid,target_plan uuid) returns void language plpgsql security definer set search_path=public as $$begin
 perform public.require_fee_staff(target_club);
 update club_fee_plans set archived_at=coalesce(archived_at,now()),auto_monthly=false where club_id=target_club and id=target_plan and deleted_at is null;
 if not found then raise exception 'Fee record unavailable';end if;
end $$;
create function public.run_club_fee_recurring() returns integer language plpgsql security definer set search_path=public as $$declare target uuid;total integer:=0;this_month date:=date_trunc('month',now() at time zone 'Europe/Prague')::date;begin
 for target in select distinct p.club_id from club_fee_plans p join clubs c on c.id=p.club_id join club_fee_settings s on s.club_id=c.id where p.auto_monthly and p.archived_at is null and p.deleted_at is null and p.auto_next_month<=this_month and c.archived_at is null and s.enabled order by p.club_id loop
  total:=total+public.generate_club_fee_months(target,this_month);
 end loop;return total;
end $$;
revoke all on function public.run_club_fee_recurring() from public,anon,authenticated;
create function public.club_fee_cron_ready() returns boolean language plpgsql stable security definer set search_path=public as $$declare ready boolean;begin
 if to_regclass('cron.job') is null then return false;end if;
 execute 'select exists(select 1 from cron.job where jobname=''trenomi-monthly-club-fees'' and active and command=''select public.run_club_fee_recurring();'' and schedule=''0 * * * *'')' into ready;
 return coalesce(ready,false);
end $$;
revoke all on function public.club_fee_cron_ready() from public,anon,authenticated;
create or replace function public.club_fee_ledger(target_club uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$declare staff boolean;begin
 if not public.has_club_role(target_club,array['owner','coach','member']) then raise insufficient_privilege;end if;
 if not public.get_club_fees_enabled(target_club) then raise exception 'Fees disabled';end if;
 staff:=public.has_club_role(target_club,array['owner','coach']);
 return jsonb_build_object('recurring_ready',case when staff then public.club_fee_cron_ready() else null end,
 'plans',case when staff then coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('auto_member_ids',coalesce((select jsonb_agg(a.member_id order by a.member_id) from club_fee_plan_members a where a.club_id=target_club and a.plan_id=p.id),'[]'::jsonb)) order by p.created_at,p.id) from club_fee_plans p where p.club_id=target_club and p.deleted_at is null),'[]') else '[]'::jsonb end,
 'charges',coalesce((select jsonb_agg(to_jsonb(c)-'created_by'-'cancelled_by'-'deleted_by' order by c.due_date,c.id) from club_fee_charges c where c.club_id=target_club and c.deleted_at is null and public.can_read_club_fee(c.club_id,c.member_id)),'[]'),
 'payments',coalesce((select jsonb_agg(to_jsonb(p)-'created_by'-'voided_by' order by p.paid_on,p.id) from club_fee_payments p join club_fee_charges c on c.id=p.charge_id and c.club_id=p.club_id where p.club_id=target_club and c.deleted_at is null and public.can_read_club_fee(c.club_id,c.member_id)),'[]'));
end $$;
do $$declare signature regprocedure;begin
 foreach signature in array array['public.delete_club_fee_plan(uuid,uuid)'::regprocedure,'public.delete_club_fee_charge(uuid,uuid)'::regprocedure,'public.set_club_fee_recurrence(uuid,uuid,boolean,uuid[],date,integer)'::regprocedure] loop
 execute format('revoke all on function %s from public,anon',signature);execute format('grant execute on function %s to authenticated',signature);
 end loop;
end $$;
-- Supabase supplies pg_cron. Generic local PostgreSQL can still run the worker
-- directly in regression tests. This block touches only this feature's own job.
do $$declare job bigint;begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  execute 'create extension if not exists pg_cron with schema pg_catalog';
  for job in execute 'select jobid from cron.job where jobname=''trenomi-monthly-club-fees''' loop execute 'select cron.unschedule($1)' using job;end loop;
  execute 'select cron.schedule(''trenomi-monthly-club-fees'',''0 * * * *'',''select public.run_club_fee_recurring();'')';
 else raise notice 'pg_cron unavailable: run supabase/setup/club_fee_cron.sql on Supabase to enable background billing';
 end if;
end $$;
commit;
