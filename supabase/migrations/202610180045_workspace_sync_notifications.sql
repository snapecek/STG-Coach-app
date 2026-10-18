-- Optional incremental coach workspace reads and personal RSVP e-mail preference.
begin;
create table public.club_workspace_entities(
 club_id uuid not null references public.clubs on delete cascade,
 kind text not null,entity_key text not null,change_xid xid8 not null,
 primary key(club_id,kind,entity_key)
);
alter table public.club_workspace_entities enable row level security;
revoke all on public.club_workspace_entities from public,anon,authenticated;
create index workspace_entities_cursor on public.club_workspace_entities(club_id,change_xid);
-- Store identities only, never messages, addresses, invitation tokens or snapshots.
-- Deleted identities remain as tombstones until the club is purged.
create function public.track_workspace_entity() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare row_data jsonb;old_data jsonb;entity text;old_entity text;begin
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 entity:=case tg_table_name when 'participation' then row_data->>'event_id'||':'||(row_data->>'member_id') when 'training_group_members' then row_data->>'group_id'||':'||(row_data->>'member_id') else row_data->>'id' end;
 if exists(select 1 from clubs where id=(row_data->>'club_id')::uuid) then
  insert into club_workspace_entities values((row_data->>'club_id')::uuid,tg_table_name,entity,pg_current_xact_id()) on conflict(club_id,kind,entity_key) do update set change_xid=excluded.change_xid;
 end if;
 -- Preserve the removal side of a privileged identity/club move, too.
 if tg_op='UPDATE' then
  old_data:=to_jsonb(old);
  old_entity:=case tg_table_name when 'participation' then old_data->>'event_id'||':'||(old_data->>'member_id') when 'training_group_members' then old_data->>'group_id'||':'||(old_data->>'member_id') else old_data->>'id' end;
  if (old_data->>'club_id') is distinct from (row_data->>'club_id') or old_entity is distinct from entity then
   if exists(select 1 from clubs where id=(old_data->>'club_id')::uuid) then
    insert into club_workspace_entities values((old_data->>'club_id')::uuid,tg_table_name,old_entity,pg_current_xact_id()) on conflict(club_id,kind,entity_key) do update set change_xid=excluded.change_xid;
   end if;
  end if;
 end if;
 return null;
end $$;
do $$declare tab text;begin
 foreach tab in array array['members','templates','events','participation','event_type_colors','training_groups','training_group_members','event_tasks','club_invitations'] loop
  execute format('create trigger workspace_entity_changed after insert or update or delete on public.%I for each row execute function public.track_workspace_entity()',tab);
 end loop;
end $$;
create function public.club_workspace_changes(target_club uuid,after_cursor text default null) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare next_cursor text;changes jsonb;total integer;begin
 if not has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 -- An inclusive snapshot low-watermark also sees transactions that assigned an
 -- XID earlier but commit AFTER this read. Sequence/MAX(XID) cursors lose them.
 next_cursor:=pg_snapshot_xmin(pg_current_snapshot())::text;
 if after_cursor is null then return jsonb_build_object('cursor',next_cursor,'reset',false,'changes','[]'::jsonb);end if;
 if after_cursor !~ '^[0-9]{1,20}$' then raise exception 'Invalid workspace cursor';end if;
 if after_cursor::xid8>next_cursor::xid8 then return jsonb_build_object('cursor',next_cursor,'reset',true,'changes','[]'::jsonb);end if;
 select count(*) into total from (select 1 from club_workspace_entities where club_id=target_club and change_xid>=after_cursor::xid8 limit 501) bounded;
 if total>500 then return jsonb_build_object('cursor',next_cursor,'reset',true,'changes','[]'::jsonb);end if;
 select coalesce(jsonb_agg(jsonb_build_object('kind',x.kind,'key',x.entity_key,'row',case x.kind
  when 'members' then (select jsonb_build_object('id',m.id,'club_id',m.club_id,'name',m.name,'kind',m.kind,'removed_at',m.removed_at,'purge_after',m.purge_after,'user_id',m.user_id,'event_guest',m.event_guest,'event_guest_of',m.event_guest_of,'joined_at',m.joined_at) from members m where m.club_id=target_club and m.id=x.entity_key::uuid)
  when 'events' then (select to_jsonb(e) from events e where e.club_id=target_club and e.id=x.entity_key::uuid)
  when 'templates' then (select to_jsonb(t) from templates t where t.club_id=target_club and t.id=x.entity_key::uuid)
  when 'participation' then (select to_jsonb(p) from participation p where p.club_id=target_club and p.event_id=split_part(x.entity_key,':',1)::uuid and p.member_id=split_part(x.entity_key,':',2)::uuid)
  when 'event_type_colors' then (select to_jsonb(c) from event_type_colors c where c.club_id=target_club and c.id=x.entity_key::uuid)
  else null end)),'[]'::jsonb) into changes
 from club_workspace_entities x where x.club_id=target_club and x.change_xid>=after_cursor::xid8;
 return jsonb_build_object('cursor',next_cursor,'reset',false,'changes',changes);
end $$;
create function public.notification_preferences_ready() returns boolean language sql stable security invoker as $$select auth.uid() is not null$$;
-- Existing claim AND prepare paths recheck eligibility, so disabling the
 -- preference withdraws queued messages as well as preventing new ones.
create or replace function public.eligible_member_rsvp_emails() returns table(club_id uuid,event_id uuid,member_id uuid,starts_at timestamptz,email text,member_name text,club_name text,event_name text,place text,event_kind text)
language sql stable security definer set search_path=public,pg_temp as $$
 select c.id,e.id,m.id,e.starts_at,u.email,m.name,c.name,e.name,e.place,e.event_kind
 from events e join clubs c on c.id=e.club_id
 join members m on m.club_id=c.id join auth.users u on u.id=m.user_id
 where c.archived_at is null and e.status='scheduled' and e.completed_at is null
 and e.starts_at>now()+interval '23 hours' and e.starts_at<=now()+interval '24 hours'
 and m.kind='member' and m.removed_at is null and (m.purge_after is null or m.purge_after>now())
 and (to_jsonb(u)->'raw_user_meta_data'->>'rsvp_email_enabled') is distinct from 'false'
 and u.email is not null and length(trim(u.email))>0 and u.email_confirmed_at is not null
 and exists(select 1 from club_roles r where r.club_id=c.id and r.user_id=u.id and r.role in ('owner','coach','member'))
 and (not e.roster_only or exists(select 1 from participation p where p.club_id=c.id and p.event_id=e.id and p.member_id=m.id))
 and not exists(select 1 from participation p where p.club_id=c.id and p.event_id=e.id and p.member_id=m.id and p.response is not null)
$$;

-- Operational totals only. Never expose recipients, device endpoints, payloads,
-- Vault values, SQL job commands or the Resend/VAPID/dispatch credentials.
create function public.club_notification_status(target_club uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare email_cron boolean;push_cron boolean;begin
 if not has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 if to_regclass('cron.job') is not null then
  execute $q$select coalesce(bool_or(active) filter(where jobname='trenomi-member-rsvp-email'),false),coalesce(bool_or(active) filter(where jobname='trenomi-coach-rsvp-push'),false) from cron.job where jobname in ('trenomi-member-rsvp-email','trenomi-coach-rsvp-push')$q$ into email_cron,push_cron;
 end if;
 return jsonb_build_object('email_cron',email_cron,'push_cron',push_cron,
  'email_pending',(select count(*) from member_rsvp_email_jobs where club_id=target_club and done_at is null),
  'email_sent',(select count(*) from member_rsvp_email_jobs where club_id=target_club and outcome='sent' and done_at>now()-interval '7 days'),
  'email_failed',(select count(*) from member_rsvp_email_jobs where club_id=target_club and outcome='failed' and done_at>now()-interval '7 days'),
  'push_pending',(select count(*) from coach_push_jobs where club_id=target_club and done_at is null),
  'push_processed',(select count(*) from coach_push_jobs where club_id=target_club and done_at>now()-interval '7 days'));
end $$;
revoke all on function public.track_workspace_entity(),public.club_workspace_changes(uuid,text),public.notification_preferences_ready(),public.club_notification_status(uuid) from public,anon,authenticated;
grant execute on function public.club_workspace_changes(uuid,text),public.notification_preferences_ready(),public.club_notification_status(uuid) to authenticated;
commit;
