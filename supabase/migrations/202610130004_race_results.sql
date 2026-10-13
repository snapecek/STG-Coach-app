-- Private race results. Apply after the journal/photos migration.
begin;
create table public.race_results(
 club_id uuid not null, event_id uuid not null, member_id uuid not null,
 status text not null check(status in ('finished','dnf','dns')),
 elapsed_ms integer, notes text not null default '' check(length(notes)<=1000),
 primary key(event_id,member_id),
 foreign key(club_id,event_id) references public.events(club_id,id) on delete cascade,
 foreign key(club_id,member_id) references public.members(club_id,id) on delete cascade,
 check((status='finished' and elapsed_ms is not null and elapsed_ms between 1 and 172800000) or (status in ('dnf','dns') and elapsed_ms is null))
);
alter table public.race_results enable row level security;
revoke all on public.race_results from anon;
grant select,insert,update,delete on public.race_results to authenticated;
create policy race_results_staff on public.race_results for all to authenticated
 using(public.has_club_role(club_id,array['owner','coach']) and exists(select 1 from public.members m where m.club_id=race_results.club_id and m.id=member_id))
 with check(public.has_club_role(club_id,array['owner','coach']) and exists(select 1 from public.members m where m.club_id=race_results.club_id and m.id=member_id));
create function public.guard_race_result() returns trigger language plpgsql set search_path=public as $$
begin
 if not public.has_club_role(new.club_id,array['owner','coach']) then raise insufficient_privilege using message='Staff role required';end if;
 if TG_OP='UPDATE' and (new.club_id,new.event_id,new.member_id) is distinct from (old.club_id,old.event_id,old.member_id) then raise exception 'Result identity cannot change';end if;
 perform 1 from public.events where id=new.event_id and club_id=new.club_id and event_kind='race' and status='scheduled' for update;
 if not found then raise exception 'Results require a scheduled race';end if;
 return new;
end $$;
create trigger race_result_guard before insert or update on public.race_results for each row execute function public.guard_race_result();
create function public.reopen_race_result() returns trigger language plpgsql security definer set search_path=public as $$
begin
 -- Retention cleanup must preserve historical event completion.
 if TG_OP='DELETE' and not exists(select 1 from public.members where id=old.member_id) then return old;end if;
 update public.events set completed_at=null,completed_by=null where id=case when TG_OP='DELETE' then old.event_id else new.event_id end;
 return null;
end $$;
revoke all on function public.reopen_race_result() from public;
create trigger race_result_review after insert or update or delete on public.race_results for each row execute function public.reopen_race_result();
create function public.guard_race_kind() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.event_kind<>old.event_kind and new.event_kind<>'race' and exists(select 1 from public.race_results where event_id=old.id) then raise exception 'Remove race results before changing event kind';end if;
 return new;
end $$;
revoke all on function public.guard_race_kind() from public;
create trigger race_kind_guard before update on public.events for each row execute function public.guard_race_kind();
commit;
