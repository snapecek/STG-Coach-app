begin;
alter table public.events add column activity_at timestamptz not null default now();
create function public.track_event_activity() returns trigger language plpgsql set search_path=public as $$begin
 if tg_op='INSERT' then new.activity_at=clock_timestamp();
 elsif (to_jsonb(new)-'activity_at') is distinct from (to_jsonb(old)-'activity_at') then new.activity_at=clock_timestamp();
 else new.activity_at=old.activity_at;end if;return new;
end $$;
create trigger track_event_activity before insert or update on public.events for each row execute function public.track_event_activity();
create index events_club_activity on public.events(club_id,activity_at);
create table public.club_activity_reads(club_id uuid not null references public.clubs on delete cascade,user_id uuid not null references auth.users on delete cascade,seen_at timestamptz not null default clock_timestamp(),primary key(club_id,user_id));
alter table public.club_activity_reads enable row level security;
revoke all on public.club_activity_reads from public,anon,authenticated;
insert into public.club_activity_reads(club_id,user_id) select club_id,user_id from public.club_roles;
create function public.initialize_club_activity_read() returns trigger language plpgsql security definer set search_path=public as $$begin
 insert into club_activity_reads(club_id,user_id) values(new.club_id,new.user_id) on conflict do nothing;return new;
end $$;
create trigger initialize_club_activity_read after insert on public.club_roles for each row execute function public.initialize_club_activity_read();
create trigger guard_active_club_data before insert or update or delete on public.club_activity_reads for each row execute function public.guard_active_club_data();
create function public.club_activity_summary() returns table(club_id uuid,event_count bigint,message_count bigint,events_through timestamptz)
language plpgsql stable security definer set search_path=public as $$declare c record;begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 for c in select r.club_id from club_roles r where r.user_id=auth.uid() and public.has_club_role(r.club_id,array['owner','coach','member']) loop
  return query select c.club_id,
   (select count(*) from events e where e.club_id=c.club_id and (public.has_club_role(c.club_id,array['owner','coach']) or public.can_read_club_event(c.club_id,e.id)) and e.activity_at>coalesce((select a.seen_at from club_activity_reads a where a.club_id=c.club_id and a.user_id=auth.uid()),now())),
   case when public.can_use_club_communication(c.club_id) then (select coalesce(sum(t.unread),0)::bigint from public.conversation_threads(c.club_id) t) else 0::bigint end,
   (select coalesce(max(e.activity_at),now()) from events e where e.club_id=c.club_id and (public.has_club_role(c.club_id,array['owner','coach']) or public.can_read_club_event(c.club_id,e.id)));
 end loop;
end $$;
create function public.mark_club_activity_seen(target_club uuid,through_at timestamptz) returns void language plpgsql security definer set search_path=public as $$begin
 if not public.has_club_role(target_club,array['owner','coach','member']) then raise insufficient_privilege;end if;
 if through_at is null or through_at>clock_timestamp() then raise exception 'Invalid activity marker';end if;
 insert into club_activity_reads(club_id,user_id,seen_at) values(target_club,auth.uid(),through_at) on conflict(club_id,user_id) do update set seen_at=greatest(club_activity_reads.seen_at,excluded.seen_at);
end $$;
revoke all on function public.track_event_activity(),public.initialize_club_activity_read() from public,anon,authenticated;
revoke all on function public.club_activity_summary(),public.mark_club_activity_seen(uuid,timestamptz) from public,anon;
grant execute on function public.club_activity_summary(),public.mark_club_activity_seen(uuid,timestamptz) to authenticated;
commit;
