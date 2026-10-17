begin;
-- The cover is a private Storage path, never a temporary browser blob URL.
alter table public.events add column cover_photo_path text;
create function public.validate_event_cover_photo() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' and old.event_kind='training' and new.event_kind='race' then new.cover_photo_path:=null;return new;end if;
 if new.cover_photo_path is null then return new;end if;
 if new.event_kind<>'training' or new.cover_photo_path !~ ('^'||new.club_id::text||'/'||new.id::text||'/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$') then
  raise exception 'Invalid event cover photo path';
 end if;
 if not exists(select 1 from storage.objects where bucket_id='club-photos' and name=new.cover_photo_path) then
  raise exception 'Event cover photo unavailable';
 end if;
 return new;
end $$;
create trigger validate_event_cover_photo before insert or update of cover_photo_path,event_kind on public.events for each row execute function public.validate_event_cover_photo();
-- Existing event RLS and archived-club guards continue to control all writes.
commit;
