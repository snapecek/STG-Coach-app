begin;
alter table public.participation add column attendance_excused boolean not null default false;
create function public.guard_attendance_excuse() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' and new.attended is distinct from old.attended and new.attendance_excused=old.attendance_excused then new.attendance_excused:=false;end if;
 if new.attendance_excused then new.attended:=false;end if;
 return new;
end $$;
revoke all on function public.guard_attendance_excuse() from public,anon;
create trigger b_attendance_excuse before insert or update on public.participation for each row execute function public.guard_attendance_excuse();
-- Staff-only RLS remains in force; member RSVP functions cannot alter this field.
create function public.mark_training_present(target_club uuid,target_event uuid,entrants uuid[]) returns integer language plpgsql security definer set search_path=public as $$
declare e public.events; m uuid; n integer:=0; changed integer;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select * into e from public.events where id=target_event and club_id=target_club for update;
 if not found or e.event_kind<>'training' or e.status<>'scheduled' or e.starts_at>now() then raise exception 'Vyberte zahájený trénink.';end if;
 if entrants is null or cardinality(entrants)<1 or cardinality(entrants)>500 then raise exception 'Neplatný počet členů.';end if;
 for m in select distinct unnest(entrants) loop
  if not exists(select 1 from public.members x where x.id=m and x.club_id=target_club and ((not e.roster_only and (x.removed_at is null or x.removed_at>e.starts_at)) or exists(select 1 from public.participation p where p.event_id=e.id and p.member_id=m))) then raise exception 'Člen není v soupisce.';end if;
  insert into public.participation(club_id,event_id,member_id,attended,confirmed_by) values(target_club,target_event,m,true,auth.uid()) on conflict(event_id,member_id) do update set attended=true,attendance_excused=false,confirmed_by=auth.uid() where participation.attended is null;
  get diagnostics changed=row_count;n:=n+changed;
 end loop;
 return n;
end $$;
revoke all on function public.mark_training_present(uuid,uuid,uuid[]) from public,anon;
grant execute on function public.mark_training_present(uuid,uuid,uuid[]) to authenticated;
commit;
