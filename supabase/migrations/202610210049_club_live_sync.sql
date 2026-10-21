begin;
-- A private invalidation counter, never row contents or invitation/chat payloads.
create table public.club_live_changes(
 club_id uuid primary key references public.clubs on delete cascade,
 revision bigint not null default 0,
 change_xid xid8 not null default pg_current_xact_id()
);
alter table public.club_live_changes enable row level security;
revoke all on public.club_live_changes from public,anon,authenticated;
grant select on public.club_live_changes to authenticated;
create policy club_live_read on public.club_live_changes for select to authenticated
 using (public.can_use_club_communication(club_id));
insert into public.club_live_changes(club_id) select id from public.clubs;
create function public.signal_club_live_change() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare current_row jsonb;previous_row jsonb;target uuid;previous_target uuid;begin
 current_row:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 target:=(case when tg_table_name='clubs' then current_row->>'id' else current_row->>'club_id' end)::uuid;
 if tg_op='UPDATE' then
  previous_row:=to_jsonb(old);
  previous_target:=(case when tg_table_name='clubs' then previous_row->>'id' else previous_row->>'club_id' end)::uuid;
 end if;
 -- Only one signal per club and transaction, even for a batch of 30 attendees.
 for target in select distinct x from unnest(array[target,previous_target]) x where x is not null loop
  if exists(select 1 from clubs where id=target) then
   insert into club_live_changes(club_id,revision) values(target,1)
   on conflict(club_id) do update set revision=club_live_changes.revision+1,change_xid=pg_current_xact_id()
   where club_live_changes.change_xid is distinct from pg_current_xact_id();
  end if;
 end loop;
 return null;
end $$;
do $$declare tab text;begin
 foreach tab in array array['clubs','club_roles','members','events','templates','participation','event_type_colors','training_groups','training_group_members','event_tasks','club_invitations','club_join_invitations','club_join_requests','club_join_links','club_weekly_goals','club_presets','club_locations','training_performances','race_results','race_teams','race_team_members','training_games','training_game_entries','training_game_teams','club_fee_settings','club_fee_plans','club_fee_charges','club_fee_payments'] loop
  execute format('create trigger club_live_changed after insert or update or delete on public.%I for each row execute function public.signal_club_live_change()',tab);
 end loop;
 -- The hosted project normally has this publication already; local tests may not.
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
  create publication supabase_realtime;
 end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='club_live_changes') then
  alter publication supabase_realtime add table public.club_live_changes;
 end if;
end $$;
create function public.club_live_sync_ready() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='club_live_changes')
$$;
revoke all on function public.signal_club_live_change(),public.club_live_sync_ready() from public,anon,authenticated;
grant execute on function public.club_live_sync_ready() to authenticated;
commit;
