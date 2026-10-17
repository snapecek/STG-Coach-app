-- Members may view/share photos of accessible trainings, never upload/delete them.
-- Leave can_read_event_photo unchanged: upload and delete policies rely on its staff-only check.
begin;
create function public.can_view_member_training_photo(path text) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare parts text[];
begin
 if path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$' then return false;end if;
 parts:=string_to_array(path,'/');
 return public.has_club_role(parts[1]::uuid,array['member'])
 and exists(select 1 from public.members m where m.club_id=parts[1]::uuid and m.user_id=auth.uid() and m.removed_at is null and (m.purge_after is null or m.purge_after>now()))
 and public.can_read_club_event(parts[1]::uuid,parts[2]::uuid)
 and exists(select 1 from public.events e where e.club_id=parts[1]::uuid and e.id=parts[2]::uuid and e.event_kind='training' and e.status='scheduled');
exception when invalid_text_representation then return false;
end $$;
revoke all on function public.can_view_member_training_photo(text) from public,anon;
grant execute on function public.can_view_member_training_photo(text) to authenticated;
create policy event_photos_member_read on storage.objects for select to authenticated
 using(bucket_id='club-photos' and public.can_view_member_training_photo(name));
commit;
