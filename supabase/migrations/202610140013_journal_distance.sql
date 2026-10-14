begin;
alter table public.events add column actual_distance_km numeric(10,3);
alter table public.events add constraint training_actual_distance_valid check(actual_distance_km is null or (event_kind='training' and actual_distance_km>=0 and actual_distance_km<=10000));
create function public.guard_journal_distance() returns trigger language plpgsql set search_path=public as $$
begin
 if old.event_kind='training' and new.event_kind='race' then new.actual_distance_km:=null;end if;
 if new.actual_distance_km is distinct from old.actual_distance_km then new.completed_at:=null;new.completed_by:=null;end if;
 return new;
end $$;
revoke all on function public.guard_journal_distance() from public,anon;
create trigger journal_distance_guard before update on public.events for each row execute function public.guard_journal_distance();
-- Existing event RLS and composite club/roster protections apply to the new field.
commit;
