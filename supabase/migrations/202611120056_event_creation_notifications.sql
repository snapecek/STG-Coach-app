-- Optional announcements for newly created events, using the existing inbox/worker.
begin;
create function public.queue_event_created_notices(target_club uuid,target_event uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare e events;club_name text;body_text text;begin
 if not has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select v.* into e from events v join clubs c on c.id=v.club_id
 where v.id=target_event and v.club_id=target_club and v.status='scheduled' and c.archived_at is null;
 if not found then raise insufficient_privilege;end if;
 select c.name into club_name from clubs c where c.id=target_club;
 body_text:=case e.event_kind when 'race' then 'Nový závod v kalendáři.' else 'Nový trénink v kalendáři.' end
  ||E'\nTermín: '||to_char(e.starts_at at time zone 'Europe/Prague','DD. MM. YYYY HH24:MI')
  ||E'\nMísto: '||e.place;
 with notices as (
  insert into event_change_notices(club_id,event_id,user_id,title,body)
  select e.club_id,e.id,r.user_id,club_name||' · '||e.name,body_text from club_roles r
  where r.club_id=e.club_id and can_receive_event_change(e.club_id,e.id,r.user_id)
  returning *
 ) insert into coach_push_jobs(club_id,event_id,user_id,subscription_id,notice_id,payload)
 select n.club_id,n.event_id,n.user_id,s.id,n.id,jsonb_build_object('title',n.title,'body',n.body,
  'expiresAt',now()+interval '1 day','url','/?push-club='||n.club_id||'&push-event='||n.event_id||'&push-kind=change')
 from notices n join coach_push_subscriptions s on s.user_id=n.user_id;
end $$;

-- Definer wrappers can call the private enqueue helper. Each explicitly checks
-- staff access and delegates creation/validation to the original club-scoped RPC.
-- The original functions finish the entire roster (including race guests) before
-- recipients are selected. No INSERT trigger can observe a half-built roster.
create function public.create_training_series_with_notice(target_club uuid,sessions jsonb) returns setof public.events
language plpgsql security definer set search_path=public,pg_temp as $$declare e events;begin
 if not has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 for e in select * from public.create_training_series(target_club,sessions) loop
  perform public.queue_event_created_notices(target_club,e.id);
  return next e;
 end loop;
end $$;
create function public.create_group_trainings_with_notice(target_club uuid,target_group uuid,sessions jsonb) returns setof public.events
language plpgsql security definer set search_path=public,pg_temp as $$declare e events;begin
 if not has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 for e in select * from public.create_group_trainings(target_club,target_group,sessions) loop
  perform public.queue_event_created_notices(target_club,e.id);
  return next e;
 end loop;
end $$;
create function public.create_club_race_with_notice(target_club uuid,race jsonb,entrants uuid[]) returns public.events
language plpgsql security definer set search_path=public,pg_temp as $$declare e events;begin
 if not has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 e:=public.create_club_race(target_club,race,entrants);
 perform public.queue_event_created_notices(target_club,e.id);
 return e;
end $$;
revoke all on function public.queue_event_created_notices(uuid,uuid) from public,anon,authenticated;
revoke all on function public.create_training_series_with_notice(uuid,jsonb),public.create_group_trainings_with_notice(uuid,uuid,jsonb),public.create_club_race_with_notice(uuid,jsonb,uuid[]) from public,anon;
grant execute on function public.create_training_series_with_notice(uuid,jsonb),public.create_group_trainings_with_notice(uuid,uuid,jsonb),public.create_club_race_with_notice(uuid,jsonb,uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
