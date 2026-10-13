begin;
-- Freeze historical reservation allocation: retention must not promote a past
-- waiting member and reopen an otherwise completed journal. Attendance remains editable.
create or replace function public.rebalance_training_seats(target_event uuid) returns void
language plpgsql security definer set search_path=public as $$
declare e public.events;
begin
 select * into e from public.events where id=target_event for update;
 if not found or e.starts_at<=now() then return;end if;
 with ranked as (
 select p.member_id,row_number() over(order by p.reservation_order,p.member_id) as position
 from public.participation p join public.members m on m.id=p.member_id and m.club_id=p.club_id
 where p.event_id=e.id and p.response='yes' and (e.starts_at<=now() or m.removed_at is null)
 ), desired as (
 select p.member_id,case when r.position is null then null
 when e.capacity is null or r.position<=e.capacity then 'confirmed' else 'waiting' end as status
 from public.participation p left join ranked r using(member_id) where p.event_id=e.id
 )
 update public.participation p set seat_status=d.status from desired d
 where p.event_id=e.id and p.member_id=d.member_id and p.seat_status is distinct from d.status;
end $$;
create or replace function public.guard_reservation() returns trigger language plpgsql security definer set search_path=public as $$
begin
 -- Nested updates come exclusively from the revoked internal rebalance functions.
 if pg_trigger_depth()>1 then return new;end if;
 perform 1 from public.events where id=new.event_id for update;
 if tg_op='UPDATE' and (new.event_id<>old.event_id or new.member_id<>old.member_id or new.club_id<>old.club_id) then raise exception 'Participation identity cannot change';end if;
 if new.response='yes' then
 if tg_op='UPDATE' and old.response='yes' then new.reservation_order:=old.reservation_order;
 else new.reservation_order:=nextval('public.reservation_order');end if;
 else new.reservation_order:=null;end if;
 -- The client cannot choose its place or forge a confirmed seat.
 if tg_op='UPDATE' and new.response='yes' and old.response='yes' then new.seat_status:=old.seat_status;else new.seat_status:=null;end if;
 return new;
end $$;
commit;
