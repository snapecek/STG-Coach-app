begin;
-- Reservations apply to training only, never to an organiser's race registration.
alter table public.events add column capacity integer check(capacity between 1 and 500);
alter table public.events add constraint training_capacity_only check(event_kind='training' or capacity is null);
create sequence public.reservation_order;
revoke all on sequence public.reservation_order from public,anon,authenticated;
alter table public.participation add column reservation_order bigint,
 add column seat_status text check(seat_status in ('confirmed','waiting'));
-- Existing yes responses have no historical ordering: initialise deterministically.
update public.participation set reservation_order=nextval('public.reservation_order'),seat_status='confirmed' where response='yes';
create function public.rebalance_training_seats(target_event uuid) returns void
language plpgsql security definer set search_path=public as $$
declare e public.events;
begin
 select * into e from public.events where id=target_event for update;
 if not found then return;end if;
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
create function public.guard_reservation() returns trigger language plpgsql security definer set search_path=public as $$
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
 if tg_op='UPDATE' then new.seat_status:=old.seat_status;else new.seat_status:=null;end if;
 return new;
end $$;
create trigger a_reservation_guard before insert or update on public.participation for each row execute function public.guard_reservation();
create function public.refresh_reservations() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if pg_trigger_depth()>1 then return null;end if;
 if tg_op='DELETE' then perform public.rebalance_training_seats(old.event_id);
 else perform public.rebalance_training_seats(new.event_id);end if;
 return null;
end $$;
create trigger z_refresh_reservations after insert or update or delete on public.participation for each row execute function public.refresh_reservations();
create function public.guard_training_capacity() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.capacity is distinct from old.capacity then
 if old.starts_at<=now() then raise exception 'Capacity is closed after training starts';end if;
 if new.capacity is not null and new.capacity<(select count(*) from public.participation where event_id=old.id and seat_status='confirmed') then raise exception 'Capacity below confirmed reservations';end if;
 end if;
 return new;
end $$;
create trigger a_training_capacity before update on public.events for each row execute function public.guard_training_capacity();
create function public.refresh_event_capacity() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.capacity is distinct from old.capacity then perform public.rebalance_training_seats(new.id);end if;return null;
end $$;
create trigger z_event_capacity after update on public.events for each row execute function public.refresh_event_capacity();
create function public.release_archived_reservations() returns trigger language plpgsql security definer set search_path=public as $$
declare e record;
begin
 if new.removed_at is distinct from old.removed_at then
 for e in select ev.id from public.events ev join public.participation p on p.event_id=ev.id
 where p.member_id=new.id and ev.starts_at>now() order by ev.id loop
 -- Archiving releases future reservations; restoration does not rejoin automatically.
 if new.removed_at is not null then update public.participation set response='no',reservation_order=null,seat_status=null where event_id=e.id and member_id=new.id;end if;
 perform public.rebalance_training_seats(e.id);
 end loop;end if;return null;
end $$;
create trigger z_release_archived after update on public.members for each row execute function public.release_archived_reservations();
revoke all on function public.rebalance_training_seats(uuid),public.guard_reservation(),public.refresh_reservations(),public.guard_training_capacity(),public.refresh_event_capacity(),public.release_archived_reservations() from public,anon,authenticated;
-- Fetch after triggers so RSVP returns the authoritative seat allocation.
create or replace function public.respond_to_club_event(target_club uuid,target_event uuid,answer text) returns public.participation language plpgsql security definer set search_path=public as $$
declare m public.members;e public.events;result public.participation;
begin
 if not public.has_club_role(target_club,array['owner','coach','member']) then raise insufficient_privilege;end if;
 if answer is null or answer not in ('yes','no','maybe') then raise exception 'Invalid response';end if;
 select * into m from public.members where club_id=target_club and user_id=auth.uid() and removed_at is null and (purge_after is null or purge_after>now()) for update;
 if not found then raise exception 'No linked active member';end if;
 select * into e from public.events where id=target_event and club_id=target_club for update;
 if not found or e.status<>'scheduled' or e.starts_at<=now() or e.completed_at is not null then raise exception 'RSVP closed';end if;
 if e.event_kind='race' and not exists(select 1 from public.participation where event_id=e.id and member_id=m.id) then raise exception 'Not on the race roster';end if;
 insert into public.participation(club_id,event_id,member_id,response) values(target_club,e.id,m.id,answer) on conflict(event_id,member_id) do update set response=excluded.response;
 select * into result from public.participation where event_id=e.id and member_id=m.id;
 return result;
end $$;
commit;
