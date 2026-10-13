begin;
create table public.event_tasks(
 id uuid primary key default gen_random_uuid(),club_id uuid not null,event_id uuid not null,
 title text not null check(length(trim(title)) between 1 and 160),assignee_id uuid,due_at timestamptz check(due_at is null or isfinite(due_at)),
 completed_at timestamptz,completed_by uuid references auth.users,
 foreign key(club_id,event_id) references public.events(club_id,id) on delete cascade,
 foreign key(club_id,assignee_id) references public.members(club_id,id) on delete set null(assignee_id)
);
alter table public.event_tasks enable row level security;
revoke all on public.event_tasks from public,anon,authenticated;
grant select,insert,update,delete on public.event_tasks to authenticated;
create policy tasks_staff on public.event_tasks for all to authenticated using(public.has_club_role(club_id,array['owner','coach'])) with check(public.has_club_role(club_id,array['owner','coach']));
create function public.guard_event_task() returns trigger language plpgsql security definer set search_path=public as $$
declare e public.events;
begin
 if tg_op='UPDATE' and (new.id,new.club_id,new.event_id) is distinct from (old.id,old.club_id,old.event_id) then raise exception 'Task identity cannot change';end if;
 if tg_op='UPDATE' and new.assignee_id is null and old.assignee_id is not null and not exists(select 1 from public.members where id=old.assignee_id) and (new.title,new.due_at,new.completed_at,new.completed_by) is not distinct from (old.title,old.due_at,old.completed_at,old.completed_by) then return new;end if;
 select * into e from public.events where id=new.event_id and club_id=new.club_id for update;
 if not found or e.status='cancelled' then raise exception 'Tasks require a scheduled event';end if;
 if tg_op='INSERT' and (select count(*) from public.event_tasks where event_id=e.id)>=100 then raise exception 'At most 100 tasks per event';end if;
 if new.assignee_id is not null and (tg_op='INSERT' or new.assignee_id is distinct from old.assignee_id) then
 if not exists(select 1 from public.members where id=new.assignee_id and club_id=new.club_id and removed_at is null and (purge_after is null or purge_after>now())) then raise exception 'Active assignee in this club required';end if;
 if (e.roster_only or e.event_kind='race') and not exists(select 1 from public.participation where event_id=e.id and member_id=new.assignee_id) then raise exception 'Assignee must be on this roster';end if;
 end if;
 if tg_op='INSERT' or new.completed_at is distinct from old.completed_at then
 if new.completed_at is not null then new.completed_at:=now();new.completed_by:=auth.uid();else new.completed_by:=null;end if;
 elsif tg_op='UPDATE' then new.completed_by:=old.completed_by;end if;
 return new;
end $$;
create trigger tasks_guard before insert or update on public.event_tasks for each row execute function public.guard_event_task();
create function public.my_event_tasks(target_club uuid) returns table(id uuid,event_id uuid,title text,due_at timestamptz,completed_at timestamptz)
 language sql stable security definer set search_path=public as $$
 select t.id,t.event_id,t.title,t.due_at,t.completed_at from public.event_tasks t join public.members m on m.id=t.assignee_id and m.club_id=t.club_id
 where t.club_id=target_club and m.user_id=auth.uid() and m.removed_at is null and (m.purge_after is null or m.purge_after>now()) and public.can_read_club_event(t.club_id,t.event_id);
$$;
create function public.complete_event_task(target_club uuid,target_task uuid,finished boolean) returns void
 language plpgsql security definer set search_path=public as $$
declare t public.event_tasks;
begin
 select * into t from public.event_tasks where id=target_task and club_id=target_club for update;
 if not found or finished is null then raise exception 'Task unavailable';end if;
 if not public.has_club_role(target_club,array['owner','coach']) and not exists(
 select 1 from public.members m where m.id=t.assignee_id and m.club_id=t.club_id and m.user_id=auth.uid() and m.removed_at is null and (m.purge_after is null or m.purge_after>now()) and public.can_read_club_event(t.club_id,t.event_id)
 ) then raise insufficient_privilege;end if;
 update public.event_tasks set completed_at=case when finished then coalesce(completed_at,now()) else null end where id=t.id;
end $$;
revoke all on function public.guard_event_task(),public.my_event_tasks(uuid),public.complete_event_task(uuid,uuid,boolean) from public,anon;
grant execute on function public.my_event_tasks(uuid),public.complete_event_task(uuid,uuid,boolean) to authenticated;
commit;
