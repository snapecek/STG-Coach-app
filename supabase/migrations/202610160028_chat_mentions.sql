begin;
create table public.chat_mentions(
 message_id bigint not null references public.chat_messages(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null,created_at timestamptz not null default now(),read_at timestamptz,
 primary key(message_id,user_id)
);
create index chat_mentions_inbox on public.chat_mentions(user_id,created_at desc) where read_at is null;
alter table public.chat_mentions enable row level security;
revoke all on public.chat_mentions from public,anon,authenticated;
create function public.can_receive_chat_mention(target_club uuid,target_event uuid,target_conversation uuid,target_user uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from club_roles r where r.club_id=target_club and r.user_id=target_user
 and (r.role in ('owner','coach') or exists(select 1 from members m where m.club_id=r.club_id and m.user_id=r.user_id and m.removed_at is null and (m.purge_after is null or m.purge_after>now())))
 and (case when target_event is not null then target_conversation is null and exists(select 1 from events e where e.club_id=target_club and e.id=target_event and (r.role in ('owner','coach') or not e.roster_only or exists(select 1 from participation p join members m on m.id=p.member_id and m.club_id=p.club_id where p.event_id=e.id and m.user_id=target_user and m.removed_at is null and (m.purge_after is null or m.purge_after>now()))))
 when target_conversation is not null then exists(select 1 from coach_conversations c where c.club_id=target_club and c.id=target_conversation and (c.member_user_id=target_user or r.role in ('owner','coach')))
 else false end));
$$;
revoke all on function public.can_receive_chat_mention(uuid,uuid,uuid,uuid) from public,anon,authenticated;
create function public.chat_mention_candidates(target_club uuid,target_event uuid default null,target_conversation uuid default null)
returns table(user_id uuid,name text,role text) language plpgsql stable security definer set search_path=public as $$begin
 if not public.can_read_conversation(target_club,target_event,target_conversation) or (target_event is null and target_conversation is null) then raise insufficient_privilege;end if;
 return query select r.user_id,coalesce((select m.name from members m where m.club_id=target_club and m.user_id=r.user_id and m.removed_at is null limit 1),left(nullif(trim(to_jsonb(u)->'raw_user_meta_data'->>'full_name'),''),80),case when r.role in ('owner','coach') then 'Trenér' else 'Člen' end),r.role::text
 from club_roles r join auth.users u on u.id=r.user_id where r.club_id=target_club and r.user_id<>auth.uid() and public.can_receive_chat_mention(target_club,target_event,target_conversation,r.user_id) order by 2,r.user_id;
end $$;
create function public.send_conversation_message_with_mentions(target_club uuid,target_event uuid,target_conversation uuid,message_body text,mentioned_users uuid[] default '{}')
returns bigint language plpgsql security definer set search_path=public as $$declare result bigint;recipient uuid;recipient_name text;begin
 if not public.can_read_conversation(target_club,target_event,target_conversation) then raise insufficient_privilege;end if;
 if coalesce(cardinality(mentioned_users),0)>20 then raise exception 'Too many mentions';end if;
 for recipient in select distinct unnest(mentioned_users) loop
  select c.name into recipient_name from public.chat_mention_candidates(target_club,target_event,target_conversation)c where c.user_id=recipient;
  if recipient_name is null or position('@'||recipient_name in message_body)=0 then raise insufficient_privilege;end if;
 end loop;
 result:=public.send_conversation_message(target_club,target_event,target_conversation,message_body);
 insert into chat_mentions(message_id,user_id,display_name) select result,c.user_id,c.name from public.chat_mention_candidates(target_club,target_event,target_conversation)c where c.user_id=any(mentioned_users);
 return result;
end $$;
create function public.list_conversation_messages_with_mentions(target_club uuid,target_event uuid default null,target_conversation uuid default null,before_id bigint default null)
returns table(id bigint,author_name text,body text,created_at timestamptz,is_own boolean,mentions jsonb)
language sql stable security definer set search_path=public as $$
 select m.*,coalesce((select jsonb_agg(jsonb_build_object('user_id',n.user_id,'name',n.display_name) order by n.user_id) from chat_mentions n where n.message_id=m.id),'[]'::jsonb)
 from public.list_conversation_messages(target_club,target_event,target_conversation,before_id)m;
$$;
create function public.list_chat_mentions(target_club uuid)
returns table(message_id bigint,event_id uuid,conversation_id uuid,author_name text,body text,created_at timestamptz,event_name text)
language plpgsql stable security definer set search_path=public as $$begin
 if not public.can_use_club_communication(target_club) then raise insufficient_privilege;end if;
 return query select m.id,m.event_id,m.conversation_id,m.author_name,left(m.body,240),m.created_at,e.name from chat_mentions n join chat_messages m on m.id=n.message_id left join events e on e.id=m.event_id where n.user_id=auth.uid() and n.read_at is null and m.club_id=target_club and public.can_read_conversation(target_club,m.event_id,m.conversation_id) order by n.created_at desc,m.id desc limit 100;
end $$;
create function public.read_chat_mention(target_club uuid,target_message bigint)
returns void language plpgsql security definer set search_path=public as $$begin
 if not exists(select 1 from chat_messages m join chat_mentions n on n.message_id=m.id where m.club_id=target_club and m.id=target_message and n.user_id=auth.uid() and public.can_read_conversation(target_club,m.event_id,m.conversation_id)) then raise insufficient_privilege;end if;
 update chat_mentions set read_at=coalesce(read_at,now()) where message_id=target_message and user_id=auth.uid();
end $$;
revoke all on function public.chat_mention_candidates(uuid,uuid,uuid),public.send_conversation_message_with_mentions(uuid,uuid,uuid,text,uuid[]),public.list_conversation_messages_with_mentions(uuid,uuid,uuid,bigint),public.list_chat_mentions(uuid),public.read_chat_mention(uuid,bigint) from public,anon;
grant execute on function public.chat_mention_candidates(uuid,uuid,uuid),public.send_conversation_message_with_mentions(uuid,uuid,uuid,text,uuid[]),public.list_conversation_messages_with_mentions(uuid,uuid,uuid,bigint),public.list_chat_mentions(uuid),public.read_chat_mention(uuid,bigint) to authenticated;
commit;
