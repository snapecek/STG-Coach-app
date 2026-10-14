begin;
-- A member sees only the names and RSVP of the event they may attend.
-- Contact information, actual attendance and unrelated memberships stay private.
create function public.member_event_roster(target_club uuid,target_event uuid)
returns table(member_id uuid,name text,response text,seat_status text,is_self boolean)
language plpgsql stable security definer set search_path=public as $$
declare own_id uuid;e public.events;
begin
 if not public.has_club_role(target_club,array['owner','coach','member']) then raise insufficient_privilege;end if;
 select m.id into own_id from public.members m where m.club_id=target_club and m.user_id=auth.uid() and m.removed_at is null and (m.purge_after is null or m.purge_after>now());
 if own_id is null then raise insufficient_privilege;end if;
 select * into e from public.events where id=target_event and club_id=target_club;
 if not found then raise insufficient_privilege;end if;
 if (e.event_kind='race' or e.roster_only) and not exists(select 1 from public.participation p where p.event_id=e.id and p.member_id=own_id) then raise insufficient_privilege;end if;
 return query select m.id,m.name,p.response,p.seat_status,m.id=own_id
 from public.members m left join public.participation p on p.event_id=e.id and p.member_id=m.id
 where m.club_id=target_club and m.removed_at is null and (m.purge_after is null or m.purge_after>now())
 and ((e.event_kind='training' and not e.roster_only) or p.member_id is not null)
 order by (m.id=own_id) desc,m.name,m.id;
end $$;
revoke all on function public.member_event_roster(uuid,uuid) from public,anon;
grant execute on function public.member_event_roster(uuid,uuid) to authenticated;
commit;
