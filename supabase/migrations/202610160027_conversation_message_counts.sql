begin;
-- Reuse the existing conversation authorization, including private member threads.
create function public.conversation_threads_with_totals(target_club uuid)
returns table(event_id uuid,conversation_id uuid,unread bigint,last_id bigint,message_count bigint)
language sql stable security definer set search_path=public as $$
 select t.event_id,t.conversation_id,t.unread,t.last_id,
  (select count(*) from chat_messages m where m.club_id=target_club
   and m.event_id is not distinct from t.event_id
   and m.conversation_id is not distinct from t.conversation_id)
 from public.conversation_threads(target_club) t;
$$;
revoke all on function public.conversation_threads_with_totals(uuid) from public,anon;
grant execute on function public.conversation_threads_with_totals(uuid) to authenticated;
commit;
