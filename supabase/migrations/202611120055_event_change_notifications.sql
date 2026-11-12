-- Explicit event edits create a durable inbox entry and Web Push jobs atomically.
begin;
create table public.event_change_notices(
 id bigint generated always as identity primary key,
 club_id uuid not null references public.clubs on delete cascade,
 event_id uuid not null references public.events on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 title text not null,body text not null,
 created_at timestamptz not null default now(),read_at timestamptz
);
create index event_change_unread on public.event_change_notices(user_id,club_id,id desc) where read_at is null;
alter table public.event_change_notices enable row level security;
revoke all on public.event_change_notices from public,anon,authenticated;
alter table public.coach_push_jobs add column notice_id bigint references public.event_change_notices on delete cascade;
create unique index event_change_push_once on public.coach_push_jobs(notice_id,subscription_id) where notice_id is not null;

-- Deliberately independent of scheduled/cancelled status: cancellations are news.
create function public.can_receive_event_change(target_club uuid,target_event uuid,target_user uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from clubs c join events e on e.club_id=c.id join club_roles r on r.club_id=c.id
 where c.id=target_club and e.id=target_event and c.archived_at is null and r.user_id=target_user
 and (r.role in ('owner','coach') or (r.role='member' and exists(
  select 1 from members m where m.club_id=c.id and m.user_id=r.user_id and m.kind='member'
  and m.removed_at is null and (m.purge_after is null or m.purge_after>now())
  and (not e.roster_only or exists(select 1 from participation p where p.club_id=c.id and p.event_id=e.id and p.member_id=m.id))
 ))))
$$;
create function public.register_event_push(push_endpoint text,push_p256dh text,push_auth text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$declare sid uuid;begin
 if auth.uid() is null or not exists(select 1 from clubs c join club_roles r on r.club_id=c.id
 where c.archived_at is null and r.user_id=auth.uid() and (r.role in ('owner','coach') or (r.role='member' and exists(
  select 1 from members m where m.club_id=c.id and m.user_id=r.user_id and m.kind='member' and m.removed_at is null and (m.purge_after is null or m.purge_after>now())
 )))) then raise insufficient_privilege;end if;
 insert into coach_push_subscriptions(user_id,endpoint,p256dh,auth) values(auth.uid(),push_endpoint,push_p256dh,push_auth)
 on conflict(endpoint) do update set user_id=auth.uid(),p256dh=excluded.p256dh,auth=excluded.auth,updated_at=now() returning id into sid;
 return sid;
end $$;
create function public.list_event_change_notices(target_club uuid) returns table(id bigint,event_id uuid,title text,body text,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select n.id,n.event_id,n.title,n.body,n.created_at from event_change_notices n
 where n.club_id=target_club and n.user_id=auth.uid() and n.read_at is null
 and can_receive_event_change(n.club_id,n.event_id,auth.uid()) order by n.id desc limit 100
$$;
create function public.read_event_change_notice(target_club uuid,target_notice bigint) returns void
language plpgsql security definer set search_path=public,pg_temp as $$begin
 update event_change_notices n set read_at=coalesce(n.read_at,now())
 where n.id=target_notice and n.club_id=target_club and n.user_id=auth.uid() and can_receive_event_change(n.club_id,n.event_id,auth.uid());
 if not found then raise insufficient_privilege;end if;
end $$;

create function public.queue_event_change_notices() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare details text:='';heading text;club_name text;kind_label text;
begin
 if current_setting('trenomi.notify_event_changes',true) is distinct from 'on'
 or not has_club_role(new.club_id,array['owner','coach'])
 or (old.starts_at,old.place,old.event_location,old.status) is not distinct from (new.starts_at,new.place,new.event_location,new.status)
 then return null;end if;
 select c.name into club_name from clubs c where c.id=new.club_id and c.archived_at is null;
 if not found then return null;end if;
 kind_label:=case new.event_kind when 'race' then 'Závod' else 'Trénink' end;
 heading:=case when old.status is distinct from new.status then
  case when new.status='cancelled' then kind_label||' byl zrušen.' else kind_label||' byl obnoven.' end
  else kind_label||' se změnil.' end;
 if old.starts_at is distinct from new.starts_at then
  details:=details||E'\nTermín: '||to_char(old.starts_at at time zone 'Europe/Prague','DD. MM. YYYY HH24:MI')||' → '||to_char(new.starts_at at time zone 'Europe/Prague','DD. MM. YYYY HH24:MI')||'.';
 else details:=details||E'\nTermín: '||to_char(new.starts_at at time zone 'Europe/Prague','DD. MM. YYYY HH24:MI')||'.';end if;
 if old.place is distinct from new.place then details:=details||E'\nMísto: '||old.place||' → '||new.place||'.';
 else details:=details||E'\nMísto: '||new.place||'.';end if;
 if old.event_location is distinct from new.event_location then details:=details||E'\nMísto na mapě nebo pokyny k příchodu se změnily. Podrobnosti najdete v události.';end if;
 with notices as (
  insert into event_change_notices(club_id,event_id,user_id,title,body)
  select new.club_id,new.id,r.user_id,club_name||' · '||new.name,heading||details from club_roles r
  where r.club_id=new.club_id and can_receive_event_change(new.club_id,new.id,r.user_id)
  returning *
 ) insert into coach_push_jobs(club_id,event_id,user_id,subscription_id,notice_id,payload)
 select n.club_id,n.event_id,n.user_id,s.id,n.id,jsonb_build_object('title',n.title,'body',n.body,
  'expiresAt',now()+interval '1 day','url','/?push-club='||n.club_id||'&push-event='||n.event_id||'&push-kind=change')
 from notices n join coach_push_subscriptions s on s.user_id=n.user_id;
 return null;
end $$;
create trigger zz_event_change_notices after update on public.events for each row execute function public.queue_event_change_notices();

-- Invoker security preserves existing event RLS, validation and history triggers.
-- The local flag is restored so later ordinary writes in a transaction stay silent.
create function public.update_event_with_notice(target_club uuid,target_event uuid,patch jsonb) returns public.events
language plpgsql set search_path=public,pg_temp as $$
declare e events;updated events;previous_flag text;begin
 if not has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 if patch is null or jsonb_typeof(patch)<>'object' or exists(select 1 from jsonb_object_keys(patch) k where k not in (
  'name','starts_at','place','type','plan','duration_minutes','event_kind','status','template_id','race_distance_km','race_registration_url','capacity','event_location','training_icon'
 )) then raise invalid_parameter_value using message='Invalid event patch';end if;
 select * into e from events where club_id=target_club and id=target_event for update;
 if not found then raise insufficient_privilege;end if;
 updated:=jsonb_populate_record(e,patch);
 if not isfinite(updated.starts_at) then raise invalid_parameter_value;end if;
 previous_flag:=current_setting('trenomi.notify_event_changes',true);
 perform set_config('trenomi.notify_event_changes','on',true);
 update events set name=updated.name,starts_at=updated.starts_at,place=updated.place,type=updated.type,plan=updated.plan,
  duration_minutes=updated.duration_minutes,event_kind=updated.event_kind,status=updated.status,template_id=updated.template_id,
  race_distance_km=updated.race_distance_km,race_registration_url=updated.race_registration_url,capacity=updated.capacity,
  event_location=updated.event_location,training_icon=updated.training_icon
 where club_id=target_club and id=target_event returning * into e;
 perform set_config('trenomi.notify_event_changes',coalesce(previous_flag,''),true);
 return e;
end $$;
create function public.change_training_series_with_notice(target_club uuid,target_series uuid,action text,changes jsonb) returns setof public.events
language plpgsql set search_path=public,pg_temp as $$declare previous_flag text;begin
 previous_flag:=current_setting('trenomi.notify_event_changes',true);
 perform set_config('trenomi.notify_event_changes','on',true);
 return query select * from change_training_series(target_club,target_series,action,changes);
 perform set_config('trenomi.notify_event_changes',coalesce(previous_flag,''),true);
end $$;

-- Reuse the deployed worker/cron and its existing retry/acknowledgement protocol.
-- RSVP jobs retain their original eligibility and refreshed attendance counts.
create or replace function public.claim_coach_push_jobs(batch_size integer default 20)
returns table(job_id bigint,token uuid,endpoint text,p256dh text,auth text,payload jsonb)
language plpgsql security definer set search_path=public,pg_temp as $$begin
 delete from coach_push_jobs where created_at<now()-interval '7 days';
 update coach_push_jobs j set done_at=now() where j.done_at is null and (j.attempts>=5 or j.created_at<now()-interval '1 day'
 or not exists(select 1 from coach_push_subscriptions s where s.id=j.subscription_id and s.user_id=j.user_id)
 or case when j.notice_id is not null then not can_receive_event_change(j.club_id,j.event_id,j.user_id)
 else not exists(select 1 from events e join clubs c on c.id=e.club_id join club_roles r on r.club_id=c.id
  where e.id=j.event_id and e.starts_at>now() and e.status='scheduled' and e.completed_at is null and c.archived_at is null
  and r.user_id=j.user_id and r.role in ('owner','coach')) end)
 and (j.lease_until is null or j.lease_until<now());
 return query with selected as (
  select j.id from coach_push_jobs j where j.done_at is null and j.available_at<=now() and (j.lease_until is null or j.lease_until<now())
  order by j.id for update skip locked limit greatest(1,least(coalesce(batch_size,20),100))
 ),claimed as (
  update coach_push_jobs j set attempts=j.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes'
  from selected x where j.id=x.id returning j.*
 ) select j.id,j.lease_token,s.endpoint,s.p256dh,s.auth,
 case when j.notice_id is not null then j.payload||jsonb_build_object('tag','trenomi-event-'||j.notice_id)
 else (j.payload-'memberLabel')||jsonb_build_object('tag','trenomi-rsvp-'||j.id,'expiresAt',e.starts_at,
  'body',(j.payload->>'memberLabel')||'. Přihlášeno: '||totals.confirmed||case when totals.waiting>0 then ' · čeká: '||totals.waiting else '' end||' · '||to_char(e.starts_at at time zone 'Europe/Prague','DD. MM. HH24:MI')) end
 from claimed j join coach_push_subscriptions s on s.id=j.subscription_id join events e on e.id=j.event_id
 left join lateral(
  select count(*) filter(where p.response='yes' and (e.event_kind='race' or p.seat_status='confirmed')) as confirmed,
  count(*) filter(where p.response='yes' and p.seat_status='waiting') as waiting from participation p
  join members m on m.id=p.member_id and m.club_id=p.club_id
  where p.event_id=e.id and m.removed_at is null and (m.purge_after is null or m.purge_after>now()) and j.notice_id is null
 ) totals on true;
end $$;
revoke all on function public.can_receive_event_change(uuid,uuid,uuid),public.queue_event_change_notices() from public,anon,authenticated;
revoke all on function public.register_event_push(text,text,text),public.list_event_change_notices(uuid),public.read_event_change_notice(uuid,bigint),public.update_event_with_notice(uuid,uuid,jsonb),public.change_training_series_with_notice(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.register_event_push(text,text,text),public.list_event_change_notices(uuid),public.read_event_change_notice(uuid,bigint),public.update_event_with_notice(uuid,uuid,jsonb),public.change_training_series_with_notice(uuid,uuid,text,jsonb) to authenticated;
commit;
