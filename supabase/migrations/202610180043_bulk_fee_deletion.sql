-- Atomic bulk deletion; preserve the same audit and payment safeguards as 042.
begin;
create function public.delete_club_fee_charges(target_club uuid,charge_ids uuid[]) returns integer
language plpgsql security definer set search_path=public as $$
declare ids uuid[];selected_charge uuid;begin
 perform public.require_fee_staff(target_club);
 if charge_ids is null or cardinality(charge_ids) not between 1 and 1000 or array_position(charge_ids,null) is not null then raise exception 'Invalid fee input';end if;
 select array_agg(distinct id) into ids from unnest(charge_ids) id;
 -- All financial writes share require_fee_staff's club lock. Validate the full
 -- set before any mutation, including receipts committed since the UI loaded.
 if (select count(*) from club_fee_charges where club_id=target_club and id=any(ids) and deleted_at is null)<>cardinality(ids) then raise exception 'Fee record unavailable';end if;
 if exists(select 1 from club_fee_payments where charge_id=any(ids) and voided_at is null) then raise exception 'Fee charge has payments';end if;
 foreach selected_charge in array ids loop
  perform public.delete_club_fee_charge(target_club,selected_charge);
 end loop;
 return cardinality(ids);
end $$;
revoke all on function public.delete_club_fee_charges(uuid,uuid[]) from public,anon;
grant execute on function public.delete_club_fee_charges(uuid,uuid[]) to authenticated;
commit;
