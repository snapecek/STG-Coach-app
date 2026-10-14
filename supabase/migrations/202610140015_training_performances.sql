begin;
create function public.valid_training_splits(times integer[], planned integer) returns boolean language sql immutable set search_path=public as $$
 select times is not null and planned between 1 and 100 and cardinality(times)<=planned and coalesce(array_ndims(times),1)=1 and not exists(select 1 from unnest(times) t where t is null or t<1 or t>86400000);
$$;
create table public.training_performances(
 club_id uuid not null,event_id uuid not null,member_id uuid not null,
 distance_m integer not null check(distance_m between 1 and 100000),
 planned_repetitions integer not null check(planned_repetitions between 1 and 100),
 interval_ms integer[] not null default '{}',
 notes text not null default '' check(length(notes)<=1000),
 primary key(event_id,member_id),
 foreign key(club_id,event_id) references public.events(club_id,id) on delete cascade,
 foreign key(club_id,member_id) references public.members(club_id,id) on delete cascade,
 foreign key(event_id,member_id) references public.participation(event_id,member_id) on delete cascade,
 check(public.valid_training_splits(interval_ms,planned_repetitions))
);
alter table public.training_performances enable row level security;
revoke all on public.training_performances from anon;
grant select,insert,update,delete on public.training_performances to authenticated;
create policy training_performances_staff on public.training_performances for all to authenticated
 using(public.has_club_role(club_id,array['owner','coach'])) with check(public.has_club_role(club_id,array['owner','coach']));
create function public.guard_training_performance() returns trigger language plpgsql set search_path=public as $$
begin
 if not public.has_club_role(new.club_id,array['owner','coach']) then raise insufficient_privilege;end if;
 if tg_op='UPDATE' and (new.club_id,new.event_id,new.member_id) is distinct from (old.club_id,old.event_id,old.member_id) then raise exception 'Measurement identity cannot change';end if;
 perform 1 from public.events where id=new.event_id and club_id=new.club_id and event_kind='training' and status='scheduled' and starts_at<=now() for update;
 if not found then raise exception 'Measurements require a started training';end if;
 if not exists(select 1 from public.participation where event_id=new.event_id and member_id=new.member_id and club_id=new.club_id and attended=true and not attendance_excused) then raise exception 'Confirm actual presence before recording measurements';end if;
 return new;
end $$;
revoke all on function public.guard_training_performance() from public;
create trigger training_performance_guard before insert or update on public.training_performances for each row execute function public.guard_training_performance();
create function public.reopen_training_performance() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='DELETE' and not exists(select 1 from public.members where id=old.member_id) then return old;end if;
 update public.events set completed_at=null,completed_by=null where id=case when tg_op='DELETE' then old.event_id else new.event_id end;
 return null;
end $$;
revoke all on function public.reopen_training_performance() from public;
create trigger training_performance_review after insert or update or delete on public.training_performances for each row execute function public.reopen_training_performance();
create function public.guard_measured_training_kind() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.event_kind<>'training' and exists(select 1 from public.training_performances where event_id=new.id) then raise exception 'Remove training measurements before changing event kind';end if;
 return new;
end $$;
revoke all on function public.guard_measured_training_kind() from public;
create trigger measured_training_kind before update of event_kind on public.events for each row execute function public.guard_measured_training_kind();
commit;
