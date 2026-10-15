begin;
create table public.coach_conversations(
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs on delete cascade,member_user_id uuid not null references auth.users on delete cascade,unique(club_id,id),unique(club_id,member_user_id)
);
alter table public.coach_conversations enable row level security;
revoke all on public.coach_conversations from public,anon,authenticated;
alter table public.chat_messages add column conversation_id uuid,add foreign key(club_id,conversation_id) references public.coach_conversations(club_id,id) on delete cascade,add check(event_id is null or conversation_id is null);
create index chat_conversation_messages on public.chat_messages(club_id,conversation_id,id desc);
alter table public.chat_reads add column conversation_id uuid,add foreign key(club_id,conversation_id) references public.coach_conversations(club_id,id) on delete cascade,add check(event_id is null or conversation_id is null);
alter table public.chat_reads drop constraint chat_reads_pkey;
alter table public.chat_reads drop column thread_key;
alter table public.chat_reads add column thread_key text generated always as (coalesce('contact:'||conversation_id::text,event_id::text,'club')) stored;
alter table public.chat_reads add primary key(club_id,user_id,thread_key);
create function public.can_read_conversation(target_club uuid,target_event uuid,target_conversation uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.can_use_club_communication(target_club,target_event) and (case
 when target_event is not null then target_conversation is null
 when target_conversation is not null then exists(select 1 from coach_conversations c where c.club_id=target_club and c.id=target_conversation and (c.member_user_id=auth.uid() or public.has_club_role(target_club,array['owner','coach'])))
 else public.has_club_role(target_club,array['owner','coach']) end);
$$;
-- Every member has one private conversation with the club's coaches. Creating the
-- missing row is idempotent; clients never submit the identity of its participant.
create function public.coach_chat_contacts(target_club uuid) returns table(id uuid,name text) language plpgsql security definer set search_path=public as $$begin
 if not public.can_use_club_communication(target_club) then raise insufficient_privilege;end if;
 if public.has_club_role(target_club,array['owner','coach']) then
  insert into coach_conversations(club_id,member_user_id) select target_club,m.user_id from members m join club_roles r on r.club_id=m.club_id and r.user_id=m.user_id and r.role='member' where m.club_id=target_club and m.user_id is not null and m.removed_at is null and (m.purge_after is null or m.purge_after>now()) on conflict(club_id,member_user_id) do nothing;
 else
  insert into coach_conversations(club_id,member_user_id) values(target_club,auth.uid()) on conflict(club_id,member_user_id) do nothing;
 end if;
 return query select c.id,case when c.member_user_id=auth.uid() then 'Trenéři klubu' else coalesce((select m.name from members m where m.club_id=target_club and m.user_id=c.member_user_id),'Bývalý člen') end from coach_conversations c where c.club_id=target_club and (c.member_user_id=auth.uid() or public.has_club_role(target_club,array['owner','coach'])) order by 2,c.id;
end $$;
create function public.list_conversation_messages(target_club uuid,target_event uuid default null,target_conversation uuid default null,before_id bigint default null)
returns table(id bigint,author_name text,body text,created_at timestamptz,is_own boolean) language plpgsql stable security definer set search_path=public as $$begin
 if not public.can_read_conversation(target_club,target_event,target_conversation) then raise insufficient_privilege;end if;
 return query select m.id,m.author_name,m.body,m.created_at,m.author_id=auth.uid() from chat_messages m where m.club_id=target_club and m.event_id is not distinct from target_event and m.conversation_id is not distinct from target_conversation and (before_id is null or m.id<before_id) order by m.id desc limit 50;
end $$;
create function public.send_conversation_message(target_club uuid,target_event uuid,target_conversation uuid,message_body text) returns bigint language plpgsql security definer set search_path=public as $$declare result bigint;begin
 if (target_event is null and target_conversation is null) or not public.can_read_conversation(target_club,target_event,target_conversation) then raise insufficient_privilege;end if;
 if message_body is null or length(trim(message_body)) not between 1 and 2000 or message_body !~ '[^[:space:]]' then raise exception 'Invalid message';end if;
 perform public.consume_communication_limit('chat');
 perform pg_advisory_xact_lock(hashtextextended(target_club::text||coalesce(target_conversation::text,target_event::text),0));
 insert into chat_messages(club_id,event_id,conversation_id,author_id,author_name,body) values(target_club,target_event,target_conversation,auth.uid(),public.communication_author(target_club),trim(message_body)) returning id into result;return result;
end $$;
create function public.mark_conversation_read(target_club uuid,target_event uuid,target_conversation uuid,through_id bigint) returns void language plpgsql security definer set search_path=public as $$begin
 if not public.can_read_conversation(target_club,target_event,target_conversation) then raise insufficient_privilege;end if;
 if through_id is null or through_id<0 or through_id>coalesce((select max(id) from chat_messages where club_id=target_club and event_id is not distinct from target_event and conversation_id is not distinct from target_conversation),0) then raise exception 'Invalid read marker';end if;
 insert into chat_reads(club_id,user_id,event_id,conversation_id,last_id) values(target_club,auth.uid(),target_event,target_conversation,through_id) on conflict(club_id,user_id,thread_key) do update set last_id=greatest(chat_reads.last_id,excluded.last_id);
end $$;
create function public.conversation_threads(target_club uuid) returns table(event_id uuid,conversation_id uuid,unread bigint,last_id bigint) language plpgsql stable security definer set search_path=public as $$begin
 if not public.can_use_club_communication(target_club) then raise insufficient_privilege;end if;
 return query select m.event_id,m.conversation_id,count(*) filter(where m.author_id is distinct from auth.uid() and m.id>coalesce(r.last_id,0)),max(m.id) from chat_messages m left join chat_reads r on r.club_id=m.club_id and r.user_id=auth.uid() and r.thread_key=coalesce('contact:'||m.conversation_id::text,m.event_id::text,'club') where m.club_id=target_club and public.can_read_conversation(target_club,m.event_id,m.conversation_id) group by m.event_id,m.conversation_id,r.last_id;
end $$;
-- Old clients cannot read or post to the retired shared club channel. Event chat
-- remains backwards compatible. Existing shared messages are a coaches-only archive.
create or replace function public.list_chat_messages(target_club uuid,target_event uuid default null,before_id bigint default null) returns table(id bigint,author_name text,body text,created_at timestamptz,is_own boolean) language sql stable security definer set search_path=public as $$select * from public.list_conversation_messages(target_club,target_event,null,before_id)$$;
create or replace function public.send_chat_message(target_club uuid,target_event uuid,message_body text) returns bigint language sql security definer set search_path=public as $$select public.send_conversation_message(target_club,target_event,null,message_body)$$;
create or replace function public.mark_chat_read(target_club uuid,target_event uuid,through_id bigint) returns void language sql security definer set search_path=public as $$select public.mark_conversation_read(target_club,target_event,null,through_id)$$;
create or replace function public.delete_chat_message(target_club uuid,message_id bigint) returns void language plpgsql security definer set search_path=public as $$declare m chat_messages;begin
 select * into m from chat_messages where id=message_id and club_id=target_club and author_id=auth.uid();
 if not found or not public.can_read_conversation(target_club,m.event_id,m.conversation_id) then raise insufficient_privilege;end if;
 delete from chat_messages where id=message_id and club_id=target_club and author_id=auth.uid();
end $$;
create or replace function public.chat_threads(target_club uuid) returns table(event_id uuid,unread bigint,last_id bigint) language sql stable security definer set search_path=public as $$select t.event_id,sum(t.unread)::bigint,max(t.last_id) from public.conversation_threads(target_club) t group by t.event_id$$;
revoke all on function public.can_read_conversation(uuid,uuid,uuid),public.coach_chat_contacts(uuid),public.list_conversation_messages(uuid,uuid,uuid,bigint),public.send_conversation_message(uuid,uuid,uuid,text),public.mark_conversation_read(uuid,uuid,uuid,bigint),public.conversation_threads(uuid) from public,anon;
grant execute on function public.can_read_conversation(uuid,uuid,uuid),public.coach_chat_contacts(uuid),public.list_conversation_messages(uuid,uuid,uuid,bigint),public.send_conversation_message(uuid,uuid,uuid,text),public.mark_conversation_read(uuid,uuid,uuid,bigint),public.conversation_threads(uuid) to authenticated;
commit;
