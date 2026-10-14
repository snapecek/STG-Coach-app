begin;
create table public.club_weekly_goals(
 club_id uuid not null references public.clubs(id) on delete cascade,
 training_type text not null check(training_type=trim(training_type) and length(training_type) between 1 and 40),
 target_minutes integer not null check(target_minutes between 1 and 10080),
 primary key(club_id,training_type)
);
alter table public.club_weekly_goals enable row level security;
revoke all on public.club_weekly_goals from public,anon,authenticated;
grant select,insert,update,delete on public.club_weekly_goals to authenticated;
create policy weekly_goals_staff on public.club_weekly_goals for all to authenticated using(public.has_club_role(club_id,array['owner','coach'])) with check(public.has_club_role(club_id,array['owner','coach']));
create function public.save_weekly_goals(target_club uuid,goals jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare item jsonb;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 if jsonb_typeof(goals) is distinct from 'array' or jsonb_array_length(goals)>12 then raise exception 'Choose at most 12 goals';end if;
 -- Serialize replacement within one club. A failed row rolls back the whole replacement.
 perform pg_advisory_xact_lock(hashtextextended(target_club::text,12012));
 if (select count(distinct trim(value->>'training_type')) from jsonb_array_elements(goals))<>jsonb_array_length(goals) then raise exception 'Goal types must be distinct';end if;
 delete from public.club_weekly_goals where club_id=target_club;
 for item in select value from jsonb_array_elements(goals) loop
  insert into public.club_weekly_goals(club_id,training_type,target_minutes) values(target_club,trim(item->>'training_type'),(item->>'target_minutes')::integer);
 end loop;
end $$;
revoke all on function public.save_weekly_goals(uuid,jsonb) from public,anon;
grant execute on function public.save_weekly_goals(uuid,jsonb) to authenticated;
commit;
