-- Apply once after the first two migrations; existing journal notes stay intact.
begin;
alter table public.events add column actual_duration_minutes integer check(actual_duration_minutes between 1 and 1440), add column perceived_effort smallint check(perceived_effort between 1 and 10), add column equipment text[] not null default '{}' check(cardinality(equipment)<=30);
-- Structured journal changes reopen the review, preserving all existing completion checks.
create function public.reopen_structured_journal() returns trigger language plpgsql set search_path=public as $$
begin
 if (new.actual_duration_minutes,new.perceived_effort,new.equipment) is distinct from (old.actual_duration_minutes,old.perceived_effort,old.equipment) then new.completed_at:=null;new.completed_by:=null;end if;
 return new;
end $$;
create trigger journal_review before update on public.events for each row execute function public.reopen_structured_journal();
-- Keep images private; original filenames and EXIF are not stored by the app.
update storage.buckets set public=false,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id='club-photos';
create function public.can_read_event_photo(path text) returns boolean language plpgsql stable security definer set search_path=public as $$
declare parts text[];
begin
 if path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$' then return false;end if;
 parts:=string_to_array(path,'/');
 return public.has_club_role(parts[1]::uuid,array['owner','coach']) and exists(select 1 from public.events where club_id=parts[1]::uuid and id=parts[2]::uuid);
exception when invalid_text_representation then return false;
end $$;
create function public.can_upload_event_photo(path text) returns boolean language plpgsql security definer set search_path=public as $$
declare parts text[];event_status text;count_files integer;
begin
 if not public.can_read_event_photo(path) then return false;end if;
 parts:=string_to_array(path,'/');
 -- Serialize uploads and event deletion. An upload cannot leave a deleted event behind.
 select status into event_status from public.events where club_id=parts[1]::uuid and id=parts[2]::uuid for update;
 if not found or event_status<>'scheduled' then return false;end if;
 select count(*) into count_files from storage.objects where bucket_id='club-photos' and name like parts[1]||'/'||parts[2]||'/%';
 return count_files<20;
exception when invalid_text_representation then return false;
end $$;
revoke all on function public.can_read_event_photo(text),public.can_upload_event_photo(text) from public,anon;
grant execute on function public.can_read_event_photo(text),public.can_upload_event_photo(text) to authenticated;
drop policy photo_staff on storage.objects;
create policy event_photos_read on storage.objects for select to authenticated using(bucket_id='club-photos' and public.can_read_event_photo(name));
create policy event_photos_upload on storage.objects for insert to authenticated with check(bucket_id='club-photos' and public.can_upload_event_photo(name));
create policy event_photos_delete on storage.objects for delete to authenticated using(bucket_id='club-photos' and public.can_read_event_photo(name));
create function public.require_event_photo_cleanup() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from storage.objects where bucket_id='club-photos' and name like old.club_id::text||'/'||old.id::text||'/%') then raise exception 'Před smazáním události odstraňte její fotografie přes Storage API.';end if;
 return old;
end $$;
create trigger event_photo_cleanup before delete on public.events for each row execute function public.require_event_photo_cleanup();
-- A changed gallery reopens review; physical files are always removed using Storage API, never SQL.
create function public.reopen_event_after_photo() returns trigger language plpgsql security definer set search_path=public as $$
declare path text;parts text[];
begin
 path:=case when tg_op='DELETE' then old.name else new.name end;
 if (case when tg_op='DELETE' then old.bucket_id else new.bucket_id end)='club-photos' and path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$' then
  parts:=string_to_array(path,'/');
  update public.events set completed_at=null where club_id=parts[1]::uuid and id=parts[2]::uuid;
 end if;
 return null;
exception when invalid_text_representation then return null;
end $$;
create trigger photo_review after insert or delete on storage.objects for each row execute function public.reopen_event_after_photo();
commit;
