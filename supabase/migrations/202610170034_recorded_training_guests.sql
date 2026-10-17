begin;
-- An explicitly invited guest can later receive an account without losing history.
create function public.register_guest_account() returns trigger language plpgsql set search_path=public as $$begin
 if old.user_id is null and new.user_id is not null and new.event_guest then new.event_guest:=false;new.event_guest_of:=null;end if;
 return new;
end $$;
create trigger register_guest_account before update of user_id on public.members for each row execute function public.register_guest_account();

create function public.add_recorded_training_guest(target_club uuid,target_event uuid,target_member uuid default null,guest_name text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare e public.events;g public.members;normalized text;
begin
 if auth.uid() is null or not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select * into e from public.events where club_id=target_club and id=target_event for update;
 if not found or e.event_kind<>'training' or e.status<>'scheduled' or e.starts_at+make_interval(mins=>e.duration_minutes)>now() then raise exception 'Training not finished';end if;
 if target_member is not null then
  if guest_name is not null then raise exception 'Choose one guest source';end if;
  select * into g from public.members where club_id=target_club and id=target_member for update;
  if not found or g.kind<>'guest' or g.user_id is not null or g.removed_at is not null or g.purge_after<=now() then raise exception 'Guest unavailable';end if;
 else
  normalized:=regexp_replace(trim(guest_name),'[[:space:]]+',' ','g');
  if normalized is null or length(normalized) not between 1 and 80 or normalized !~ '[^[:space:]]' or normalized ~ '[[:cntrl:]]' then raise exception 'Invalid guest name';end if;
  perform pg_advisory_xact_lock(hashtextextended(target_club::text||lower(normalized),0));
  if exists(select 1 from public.members where club_id=target_club and kind='guest' and user_id is null and lower(regexp_replace(trim(name),'[[:space:]]+',' ','g'))=lower(normalized)) then raise exception 'Guest already exists';end if;
  -- Reusable in the register, but included only in events with explicit participation.
  insert into public.members(club_id,name,kind,event_guest) values(target_club,normalized,'guest',true) returning * into g;
 end if;
 -- Retrying an existing entry must not overwrite a previously recorded absence.
 if exists(select 1 from public.participation where event_id=target_event and member_id=g.id) then
  if exists(select 1 from public.participation where event_id=target_event and member_id=g.id and attended is true) then return g.id;end if;
  raise exception 'Guest already participating';
 end if;
 insert into public.participation(club_id,event_id,member_id,attended,confirmed_by) values(target_club,target_event,g.id,true,auth.uid()) on conflict(event_id,member_id) do nothing;
 return g.id;
end $$;
revoke all on function public.add_recorded_training_guest(uuid,uuid,uuid,text),public.register_guest_account() from public,anon;
grant execute on function public.add_recorded_training_guest(uuid,uuid,uuid,text) to authenticated;
commit;
