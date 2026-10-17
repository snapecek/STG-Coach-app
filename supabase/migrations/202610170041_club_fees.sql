-- Optional club fee ledger. All writes use checked RPCs, integer haléře and archive locks.
begin;
create table public.club_fee_settings(
 club_id uuid primary key references public.clubs on delete cascade,
 enabled boolean not null default false,
 updated_at timestamptz not null default now(),updated_by uuid references auth.users on delete set null
);
create table public.club_fee_plans(
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100),
 frequency text not null check(frequency in ('monthly','yearly')),
 amount_cents integer not null check(amount_cents between 1 and 100000000),
 archived_at timestamptz,created_at timestamptz not null default now(),created_by uuid references auth.users on delete set null
);
create table public.club_fee_charges(
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs on delete cascade,
 member_id uuid references public.members on delete set null,member_name text not null,
 kind text not null check(kind in ('membership','training')),
 title text not null check(length(trim(title)) between 1 and 160),
 amount_cents integer not null check(amount_cents between 1 and 100000000),due_date date not null,
 plan_id uuid references public.club_fee_plans on delete set null,period_start date,
 event_id uuid references public.events on delete set null,event_name text,event_starts_at timestamptz,
 created_at timestamptz not null default now(),created_by uuid references auth.users on delete set null,
 cancelled_at timestamptz,cancelled_by uuid references auth.users on delete set null,cancel_reason text not null default ''
);
create unique index fee_membership_period on public.club_fee_charges(club_id,member_id,plan_id,period_start) where kind='membership' and cancelled_at is null;
create unique index fee_training_person on public.club_fee_charges(club_id,member_id,event_id) where kind='training' and cancelled_at is null;
create index fee_charges_club_date on public.club_fee_charges(club_id,due_date,id);
create table public.club_fee_payments(
 id uuid primary key,club_id uuid not null references public.clubs on delete cascade,
 charge_id uuid not null references public.club_fee_charges on delete cascade,
 amount_cents integer not null check(amount_cents between 1 and 100000000),paid_on date not null,
 method text not null check(method in ('cash','bank','other')),note text not null default '' check(length(note)<=500),
 created_at timestamptz not null default now(),created_by uuid references auth.users on delete set null,
 voided_at timestamptz,voided_by uuid references auth.users on delete set null,void_reason text not null default ''
);
create index fee_payments_charge on public.club_fee_payments(charge_id);
-- Internal authorization helpers. Taking the shared club-state lock before checking
-- rights serializes writes with archive snapshots, settings and other fee writes.
create function public.require_fee_staff(target_club uuid) returns void language plpgsql security definer set search_path=public as $$begin
 perform pg_advisory_xact_lock(hashtextextended('club-state:'||target_club::text,0));
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 if not coalesce((select enabled from club_fee_settings where club_id=target_club),false) then raise exception 'Fees disabled';end if;
end $$;
revoke all on function public.require_fee_staff(uuid) from public,anon,authenticated;
create function public.can_read_club_fee(target_club uuid,target_member uuid) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((select enabled from club_fee_settings where club_id=target_club),false) and (
 public.has_club_role(target_club,array['owner','coach']) or (
 public.has_club_role(target_club,array['member']) and exists(select 1 from members m where m.club_id=target_club and m.id=target_member and m.user_id=auth.uid() and m.removed_at is null and (m.purge_after is null or m.purge_after>now()))));
$$;
revoke all on function public.can_read_club_fee(uuid,uuid) from public,anon;
grant execute on function public.can_read_club_fee(uuid,uuid) to authenticated;
-- No direct mutation grants. Read policies apply to staff and the member's own rows.
alter table public.club_fee_settings enable row level security;
alter table public.club_fee_plans enable row level security;
alter table public.club_fee_charges enable row level security;
alter table public.club_fee_payments enable row level security;
revoke all on public.club_fee_settings,public.club_fee_plans,public.club_fee_charges,public.club_fee_payments from public,anon,authenticated;
grant select on public.club_fee_settings,public.club_fee_plans,public.club_fee_charges,public.club_fee_payments to authenticated;
create policy fee_settings_read on public.club_fee_settings for select to authenticated using(public.has_club_role(club_id,array['owner','coach','member']));
create policy fee_plans_read on public.club_fee_plans for select to authenticated using(public.can_read_club_fee(club_id,null) and public.has_club_role(club_id,array['owner','coach']));
create policy fee_charges_read on public.club_fee_charges for select to authenticated using(public.can_read_club_fee(club_id,member_id));
create policy fee_payments_read on public.club_fee_payments for select to authenticated using(exists(select 1 from club_fee_charges c where c.id=charge_id and c.club_id=club_fee_payments.club_id and public.can_read_club_fee(c.club_id,c.member_id)));
do $$declare t text;begin
 foreach t in array array['club_fee_settings','club_fee_plans','club_fee_charges','club_fee_payments'] loop
 execute format('create trigger club_archive_write_guard before insert or update or delete on public.%I for each row execute function public.guard_active_club_data()',t);
 end loop;
end $$;
create function public.get_club_fees_enabled(target_club uuid) returns boolean language plpgsql stable security definer set search_path=public as $$begin
 if not public.has_club_role(target_club,array['owner','coach','member']) then raise insufficient_privilege;end if;
 return coalesce((select enabled from club_fee_settings where club_id=target_club),false);
end $$;
create function public.set_club_fees_enabled(target_club uuid,new_enabled boolean) returns void language plpgsql security definer set search_path=public as $$begin
 perform pg_advisory_xact_lock(hashtextextended('club-state:'||target_club::text,0));
 if not public.has_club_role(target_club,array['owner']) then raise insufficient_privilege;end if;
 if new_enabled is null then raise exception 'Invalid fee input';end if;
 insert into club_fee_settings(club_id,enabled,updated_by) values(target_club,new_enabled,auth.uid()) on conflict(club_id) do update set enabled=excluded.enabled,updated_at=now(),updated_by=auth.uid();
end $$;
create function public.create_club_fee_plan(target_club uuid,plan_name text,plan_frequency text,plan_amount integer) returns uuid language plpgsql security definer set search_path=public as $$declare result uuid;begin
 perform public.require_fee_staff(target_club);
 if plan_name is null or length(trim(plan_name)) not between 1 and 100 or plan_frequency is null or plan_frequency not in ('monthly','yearly') or plan_amount is null or plan_amount not between 1 and 100000000 then raise exception 'Invalid fee input';end if;
 insert into club_fee_plans(club_id,name,frequency,amount_cents,created_by) values(target_club,trim(plan_name),plan_frequency,plan_amount,auth.uid()) returning id into result;
 return result;
end $$;
create function public.archive_club_fee_plan(target_club uuid,target_plan uuid) returns void language plpgsql security definer set search_path=public as $$begin
 perform public.require_fee_staff(target_club);
 update club_fee_plans set archived_at=coalesce(archived_at,now()) where club_id=target_club and id=target_plan;
 if not found then raise exception 'Fee record unavailable';end if;
end $$;
create function public.create_club_fee_charges(target_club uuid,member_ids uuid[],charge_kind text,charge_title text,charge_amount integer,due_on date,period_date date default null,target_plan uuid default null,target_event uuid default null) returns integer language plpgsql security definer set search_path=public as $$
declare p club_fee_plans;e events;m members;period_value date;amount_value integer;title_value text;created_count integer;begin
 perform public.require_fee_staff(target_club);
 if member_ids is null or cardinality(member_ids) not between 1 and 1000 or array_position(member_ids,null) is not null or due_on is null or due_on not between date '2000-01-01' and date '2200-12-31' or charge_kind is null or charge_kind not in ('membership','training') then raise exception 'Invalid fee input';end if;
 if charge_kind='membership' then
  select * into p from club_fee_plans where club_id=target_club and id=target_plan and archived_at is null;
  if not found then raise exception 'Fee record unavailable';end if;
  if period_date is null or period_date not between date '2000-01-01' and date '2200-12-31' or target_event is not null then raise exception 'Invalid fee input';end if;
  period_value:=date_trunc(case when p.frequency='monthly' then 'month' else 'year' end,period_date)::date;
  amount_value:=p.amount_cents;title_value:=p.name||' · '||to_char(period_value,case when p.frequency='monthly' then 'MM/YYYY' else 'YYYY' end);
 else
  select * into e from events where club_id=target_club and id=target_event and event_kind='training' and status='scheduled';
  if not found then raise exception 'Fee record unavailable';end if;
  if target_plan is not null or period_date is not null or charge_title is null or length(trim(charge_title)) not between 1 and 100 or charge_amount is null or charge_amount not between 1 and 100000000 then raise exception 'Invalid fee input';end if;
  amount_value:=charge_amount;title_value:=trim(charge_title);
 end if;
 -- Validate the whole batch before inserting any row. Recurring fees only apply
 -- to current members; a training can also charge archived attendees and guests
 -- explicitly on its roster. An event-only guest cannot be billed on another event.
 for m in select * from members where club_id=target_club and id=any(member_ids) loop
  if charge_kind='membership' and (m.kind<>'member' or m.removed_at is not null or (m.purge_after is not null and m.purge_after<=now())) then raise exception 'Fee member unavailable';end if;
  if charge_kind='training' and not ((not coalesce(m.event_guest,false) or exists(select 1 from participation r where r.club_id=target_club and r.event_id=e.id and r.member_id=m.id)) and (case when e.roster_only then exists(select 1 from participation r where r.club_id=target_club and r.event_id=e.id and r.member_id=m.id) else m.removed_at is null or m.removed_at>e.starts_at or exists(select 1 from participation r where r.club_id=target_club and r.event_id=e.id and r.member_id=m.id and r.attended is not null) end)) then
   raise exception 'Fee member unavailable';
  end if;
 end loop;
 if (select count(*) from members where club_id=target_club and id=any(member_ids))<>(select count(distinct id) from unnest(member_ids) id) then raise exception 'Fee member unavailable';end if;
 insert into club_fee_charges(club_id,member_id,member_name,kind,title,amount_cents,due_date,plan_id,period_start,event_id,event_name,event_starts_at,created_by)
 select target_club,person.id,person.name,charge_kind,title_value,amount_value,due_on,case when charge_kind='membership' then p.id end,period_value,case when charge_kind='training' then e.id end,case when charge_kind='training' then e.name end,case when charge_kind='training' then e.starts_at end,auth.uid()
 from members person where person.club_id=target_club and person.id=any(member_ids) on conflict do nothing;
 get diagnostics created_count=row_count;return created_count;
end $$;
create function public.record_club_fee_payment(target_club uuid,target_charge uuid,payment_id uuid,payment_amount integer,payment_date date,payment_method text,payment_note text default '') returns uuid language plpgsql security definer set search_path=public as $$
declare c club_fee_charges;previous club_fee_payments;paid bigint;begin
 perform public.require_fee_staff(target_club);
 select * into c from club_fee_charges where club_id=target_club and id=target_charge for update;
 if not found or c.cancelled_at is not null then raise exception 'Fee record unavailable';end if;
 if payment_id is null or payment_amount is null or payment_amount not between 1 and 100000000 or payment_date is null or payment_date not between date '2000-01-01' and (now() at time zone 'Europe/Prague')::date or payment_method is null or payment_method not in ('cash','bank','other') or payment_note is null or length(payment_note)>500 then raise exception 'Invalid fee input';end if;
 select * into previous from club_fee_payments where id=payment_id;
 if found then
  if previous.club_id=target_club and previous.charge_id=target_charge and previous.amount_cents=payment_amount and previous.paid_on=payment_date and previous.method=payment_method and previous.note=trim(payment_note) and previous.voided_at is null then return previous.id;end if;
  raise exception 'Fee payment already exists';
 end if;
 select coalesce(sum(amount_cents),0) into paid from club_fee_payments where charge_id=c.id and voided_at is null;
 if paid+payment_amount>c.amount_cents then raise exception 'Fee payment exceeds balance';end if;
 insert into club_fee_payments(id,club_id,charge_id,amount_cents,paid_on,method,note,created_by) values(payment_id,target_club,c.id,payment_amount,payment_date,payment_method,trim(payment_note),auth.uid());return payment_id;
end $$;
create function public.void_club_fee_payment(target_club uuid,target_payment uuid,reason text) returns void language plpgsql security definer set search_path=public as $$begin
 perform public.require_fee_staff(target_club);
 if reason is null or length(trim(reason)) not between 1 and 500 then raise exception 'Invalid fee input';end if;
 update club_fee_payments set voided_at=now(),voided_by=auth.uid(),void_reason=trim(reason) where club_id=target_club and id=target_payment and voided_at is null;
 if not found then raise exception 'Fee record unavailable';end if;
end $$;
create function public.cancel_club_fee_charge(target_club uuid,target_charge uuid,reason text) returns void language plpgsql security definer set search_path=public as $$declare c club_fee_charges;begin
 perform public.require_fee_staff(target_club);
 if reason is null or length(trim(reason)) not between 1 and 500 then raise exception 'Invalid fee input';end if;
 select * into c from club_fee_charges where club_id=target_club and id=target_charge and cancelled_at is null for update;
 if not found then raise exception 'Fee record unavailable';end if;
 if exists(select 1 from club_fee_payments where charge_id=c.id and voided_at is null) then raise exception 'Fee charge has payments';end if;
 update club_fee_charges set cancelled_at=now(),cancelled_by=auth.uid(),cancel_reason=trim(reason) where id=c.id;
end $$;
-- Return a scoped snapshot. Member rows contain only that person's charges and
-- related payments, without staff ids or other members' financial information.
create function public.club_fee_ledger(target_club uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$declare result jsonb;begin
 if not public.has_club_role(target_club,array['owner','coach','member']) then raise insufficient_privilege;end if;
 if not public.get_club_fees_enabled(target_club) then raise exception 'Fees disabled';end if;
 select jsonb_build_object('plans',case when public.has_club_role(target_club,array['owner','coach']) then coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at,p.id) from club_fee_plans p where p.club_id=target_club),'[]') else '[]'::jsonb end,
 'charges',coalesce((select jsonb_agg(to_jsonb(c)-'created_by'-'cancelled_by' order by c.due_date,c.id) from club_fee_charges c where c.club_id=target_club and public.can_read_club_fee(c.club_id,c.member_id)),'[]'),
 'payments',coalesce((select jsonb_agg(to_jsonb(p)-'created_by'-'voided_by' order by p.paid_on,p.id) from club_fee_payments p join club_fee_charges c on c.id=p.charge_id and c.club_id=p.club_id where p.club_id=target_club and public.can_read_club_fee(c.club_id,c.member_id)),'[]')) into result;
 return result;
end $$;
do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('get_club_fees_enabled','set_club_fees_enabled','create_club_fee_plan','archive_club_fee_plan','create_club_fee_charges','record_club_fee_payment','void_club_fee_payment','cancel_club_fee_charge','club_fee_ledger') loop
 execute format('revoke all on function %s from public,anon',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
commit;
