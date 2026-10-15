begin;
-- All client operations use scoped RPCs; no direct table writes or public storage.
create function public.can_use_club_communication(target_club uuid,target_event uuid default null)
returns boolean language sql stable security definer set search_path=public as $$
 select public.has_club_role(target_club,array['owner','coach','member'])
 and (public.has_club_role(target_club,array['owner','coach']) or exists(select 1 from members m where m.club_id=target_club and m.user_id=auth.uid() and m.removed_at is null and (m.purge_after is null or m.purge_after>now())))
 and (target_event is null or exists(select 1 from events e where e.club_id=target_club and e.id=target_event and (public.has_club_role(target_club,array['owner','coach']) or not e.roster_only or exists(select 1 from participation p join members m on m.id=p.member_id and m.club_id=p.club_id where p.event_id=e.id and m.user_id=auth.uid() and m.removed_at is null and (m.purge_after is null or m.purge_after>now())))));
$$;
create table public.chat_messages(
 id bigint generated always as identity primary key,club_id uuid not null references public.clubs on delete cascade,event_id uuid,
 author_id uuid references auth.users on delete set null,author_name text not null,body text not null check(length(trim(body)) between 1 and 2000 and body ~ '[^[:space:]]'),created_at timestamptz not null default now(),
 foreign key(club_id,event_id) references public.events(club_id,id) on delete cascade
);
create index chat_thread_messages on public.chat_messages(club_id,event_id,id desc);
create table public.chat_reads(
 club_id uuid not null references public.clubs on delete cascade,user_id uuid not null references auth.users on delete cascade,event_id uuid,
 thread_key text generated always as (coalesce(event_id::text,'club')) stored,last_id bigint not null default 0 check(last_id>=0),
 primary key(club_id,user_id,thread_key),foreign key(club_id,event_id) references public.events(club_id,id) on delete cascade
);
create table public.app_feedback(
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs on delete cascade,author_id uuid references auth.users on delete set null,author_name text not null,
 category text not null check(category in ('bug','broken','idea')),title text not null check(length(trim(title)) between 1 and 120 and title ~ '[^[:space:]]'),body text not null check(length(trim(body)) between 1 and 5000 and body ~ '[^[:space:]]'),
 status text not null default 'new' check(status in ('new','in_progress','done')),staff_note text not null default '' check(length(staff_note)<=2000),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index feedback_club_created on public.app_feedback(club_id,created_at desc);
alter table public.chat_messages enable row level security;
alter table public.chat_reads enable row level security;
alter table public.app_feedback enable row level security;
revoke all on public.chat_messages,public.chat_reads,public.app_feedback from public,anon,authenticated;
revoke all on sequence public.chat_messages_id_seq from public,anon,authenticated;
create table public.communication_rate_limits(
 user_id uuid not null references auth.users on delete cascade,kind text not null check(kind in ('chat','feedback')),window_started timestamptz not null default now(),used integer not null default 0,primary key(user_id,kind)
);
alter table public.communication_rate_limits enable row level security;
revoke all on public.communication_rate_limits from public,anon,authenticated;
create function public.consume_communication_limit(operation_kind text) returns void language plpgsql security definer set search_path=public as $$
declare used_now integer;window_length interval;maximum integer;begin
 if operation_kind not in ('chat','feedback') or operation_kind is null or auth.uid() is null then raise insufficient_privilege;end if;
 window_length:=case when operation_kind='chat' then interval '1 minute' else interval '1 hour' end;
 maximum:=case when operation_kind='chat' then 30 else 10 end;
 insert into communication_rate_limits(user_id,kind,used) values(auth.uid(),operation_kind,1)
 on conflict(user_id,kind) do update set used=case when communication_rate_limits.window_started<=now()-window_length then 1 else communication_rate_limits.used+1 end,window_started=case when communication_rate_limits.window_started<=now()-window_length then now() else communication_rate_limits.window_started end returning used into used_now;
 if used_now>maximum then raise exception '%',case when operation_kind='chat' then 'Too many messages' else 'Too many reports' end;end if;
end $$;
revoke all on function public.consume_communication_limit(text) from public,anon,authenticated;
create function public.communication_author(target_club uuid) returns text language sql stable security definer set search_path=public as $$
 select coalesce((select m.name from members m where m.club_id=target_club and m.user_id=auth.uid() and m.removed_at is null limit 1),(select left(nullif(trim(to_jsonb(u)->'raw_user_meta_data'->>'full_name'),''),80) from auth.users u where u.id=auth.uid()),case when public.has_club_role(target_club,array['owner','coach']) then 'Trenér' else 'Člen' end);
$$;
create function public.list_chat_messages(target_club uuid,target_event uuid default null,before_id bigint default null)
returns table(id bigint,author_name text,body text,created_at timestamptz,is_own boolean)
language plpgsql stable security definer set search_path=public as $$begin
 if not public.can_use_club_communication(target_club,target_event) then raise insufficient_privilege;end if;
 return query select m.id,m.author_name,m.body,m.created_at,m.author_id=auth.uid() from chat_messages m where m.club_id=target_club and m.event_id is not distinct from target_event and (before_id is null or m.id<before_id) order by m.id desc limit 50;
end $$;
create function public.send_chat_message(target_club uuid,target_event uuid,message_body text)
returns bigint language plpgsql security definer set search_path=public as $$declare result bigint;begin
 if not public.can_use_club_communication(target_club,target_event) then raise insufficient_privilege;end if;
 if message_body is null or (length(trim(message_body)) not between 1 and 2000 or message_body !~ '[^[:space:]]') then raise exception 'Invalid message';end if;
 perform public.consume_communication_limit('chat');
 perform pg_advisory_xact_lock(hashtextextended(target_club::text||coalesce(target_event::text,'club'),0));
 insert into chat_messages(club_id,event_id,author_id,author_name,body) values(target_club,target_event,auth.uid(),public.communication_author(target_club),trim(message_body)) returning id into result;return result;
end $$;
create function public.delete_chat_message(target_club uuid,message_id bigint) returns void language plpgsql security definer set search_path=public as $$declare e uuid;begin
 select event_id into e from chat_messages where id=message_id and club_id=target_club and author_id=auth.uid();
 if not found or not public.can_use_club_communication(target_club,e) then raise insufficient_privilege;end if;
 delete from chat_messages where id=message_id and club_id=target_club and author_id=auth.uid();
end $$;
create function public.mark_chat_read(target_club uuid,target_event uuid,through_id bigint) returns void language plpgsql security definer set search_path=public as $$begin
 if not public.can_use_club_communication(target_club,target_event) then raise insufficient_privilege;end if;
 if through_id is null or through_id<0 or through_id>coalesce((select max(id) from chat_messages where club_id=target_club and event_id is not distinct from target_event),0) then raise exception 'Invalid read marker';end if;
 insert into chat_reads(club_id,user_id,event_id,last_id) values(target_club,auth.uid(),target_event,through_id) on conflict(club_id,user_id,thread_key) do update set last_id=greatest(chat_reads.last_id,excluded.last_id);
end $$;
create function public.chat_threads(target_club uuid)
returns table(event_id uuid,unread bigint,last_id bigint) language plpgsql stable security definer set search_path=public as $$begin
 if not public.can_use_club_communication(target_club) then raise insufficient_privilege;end if;
 return query select m.event_id,count(*) filter(where m.author_id is distinct from auth.uid() and m.id>coalesce(r.last_id,0)),max(m.id) from chat_messages m left join chat_reads r on r.club_id=m.club_id and r.user_id=auth.uid() and r.thread_key=coalesce(m.event_id::text,'club') where m.club_id=target_club and public.can_use_club_communication(target_club,m.event_id) group by m.event_id,r.last_id;
end $$;
create function public.submit_app_feedback(target_club uuid,feedback_category text,feedback_title text,feedback_body text)
returns uuid language plpgsql security definer set search_path=public as $$declare result uuid;begin
 if not public.can_use_club_communication(target_club) then raise insufficient_privilege;end if;
 perform public.consume_communication_limit('feedback');
 insert into app_feedback(club_id,author_id,author_name,category,title,body) values(target_club,auth.uid(),public.communication_author(target_club),feedback_category,trim(feedback_title),trim(feedback_body)) returning id into result;return result;
end $$;
create function public.list_app_feedback(target_club uuid)
returns table(id uuid,author_name text,category text,title text,body text,status text,staff_note text,created_at timestamptz,updated_at timestamptz,is_own boolean,has_image boolean)
language plpgsql stable security definer set search_path=public as $$begin
 if not public.can_use_club_communication(target_club) then raise insufficient_privilege;end if;
 return query select f.id,f.author_name,f.category,f.title,f.body,f.status,f.staff_note,f.created_at,f.updated_at,f.author_id=auth.uid(),exists(select 1 from storage.objects o where o.bucket_id='app-feedback' and o.name=f.club_id::text||'/'||f.id::text||'/image') from app_feedback f where f.club_id=target_club and (f.author_id=auth.uid() or public.has_club_role(target_club,array['owner','coach'])) order by f.created_at desc limit 100;
end $$;
create function public.update_app_feedback(target_club uuid,feedback_id uuid,new_status text,note text)
returns void language plpgsql security definer set search_path=public as $$begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 update app_feedback set status=new_status,staff_note=coalesce(note,''),updated_at=now() where club_id=target_club and id=feedback_id;
 if not found then raise insufficient_privilege;end if;
end $$;
revoke all on function public.communication_author(uuid) from public,anon,authenticated;
revoke all on function public.can_use_club_communication(uuid,uuid),public.list_chat_messages(uuid,uuid,bigint),public.send_chat_message(uuid,uuid,text),public.delete_chat_message(uuid,bigint),public.mark_chat_read(uuid,uuid,bigint),public.chat_threads(uuid),public.submit_app_feedback(uuid,text,text,text),public.list_app_feedback(uuid),public.update_app_feedback(uuid,uuid,text,text) from public,anon;
grant execute on function public.can_use_club_communication(uuid,uuid),public.list_chat_messages(uuid,uuid,bigint),public.send_chat_message(uuid,uuid,text),public.delete_chat_message(uuid,bigint),public.mark_chat_read(uuid,uuid,bigint),public.chat_threads(uuid),public.submit_app_feedback(uuid,text,text,text),public.list_app_feedback(uuid),public.update_app_feedback(uuid,uuid,text,text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('app-feedback','app-feedback',false,5242880,array['image/png','image/jpeg','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create function public.can_access_feedback_image(object_name text,writing boolean default false) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from app_feedback f where object_name=f.club_id::text||'/'||f.id::text||'/image' and public.can_use_club_communication(f.club_id) and (f.author_id=auth.uid() or (not writing and public.has_club_role(f.club_id,array['owner','coach']))));
$$;
revoke all on function public.can_access_feedback_image(text,boolean) from public,anon;
grant execute on function public.can_access_feedback_image(text,boolean) to authenticated;
create policy feedback_image_read on storage.objects for select to authenticated using(bucket_id='app-feedback' and public.can_access_feedback_image(name,false));
create policy feedback_image_insert on storage.objects for insert to authenticated with check(bucket_id='app-feedback' and public.can_access_feedback_image(name,true));
create policy feedback_image_update on storage.objects for update to authenticated using(bucket_id='app-feedback' and public.can_access_feedback_image(name,true)) with check(bucket_id='app-feedback' and public.can_access_feedback_image(name,true));
create policy feedback_image_delete on storage.objects for delete to authenticated using(bucket_id='app-feedback' and public.can_access_feedback_image(name,true));
commit;
