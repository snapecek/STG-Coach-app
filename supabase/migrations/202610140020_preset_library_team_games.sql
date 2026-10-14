begin;
create function public.valid_preset_settings(kind text,settings jsonb) returns boolean language plpgsql immutable set search_path=public as $$
begin
 if jsonb_typeof(settings)<>'object' then return false;end if;
 if kind='equipment' then return settings='{}'::jsonb;end if;
 if kind='race' then return jsonb_typeof(settings->'discipline')='string' and jsonb_typeof(settings->'minutes')='number' and (settings->'distance_km' is null or settings->'distance_km'='null'::jsonb or jsonb_typeof(settings->'distance_km')='number') and (settings->'place' is null or jsonb_typeof(settings->'place')='string') and (settings->'notes' is null or jsonb_typeof(settings->'notes')='string') and length(trim(settings->>'discipline')) between 1 and 40 and (settings->>'minutes')::integer between 5 and 480 and (settings->>'distance_km' is null or (settings->>'distance_km')::numeric between .001 and 1000) and length(coalesce(settings->>'place',''))<=200 and length(coalesce(settings->>'notes',''))<=5000;end if;
 return kind='game' and (settings->'notes' is null or jsonb_typeof(settings->'notes')='string') and settings->>'scoring' in ('time','repetitions','distance','points') and settings->>'mode' in ('individual','teams') and length(coalesce(settings->>'notes',''))<=2000;
exception when others then return false;
end $$;
create table public.club_presets(
 id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs on delete cascade,
 kind text not null check(kind in ('race','equipment','game')),name text not null,
 settings jsonb not null default '{}',
 check(length(trim(name)) between 1 and case when kind='equipment' then 40 else 80 end),
 check(public.valid_preset_settings(kind,settings) is true),
 check(kind<>'equipment' or name !~ E'[,\n]')
);
create unique index club_preset_name on public.club_presets(club_id,kind,lower(trim(name)));
alter table public.club_presets enable row level security;
grant select,insert,update,delete on public.club_presets to authenticated;
create policy presets_staff on public.club_presets for all to authenticated using(public.has_club_role(club_id,array['owner','coach'])) with check(public.has_club_role(club_id,array['owner','coach']));

alter table public.training_games add column mode text not null default 'individual' check(mode in ('individual','teams'));
create table public.training_game_teams(
 id uuid primary key,club_id uuid not null,event_id uuid not null,game_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 80),member_ids uuid[] not null check(cardinality(member_ids) between 1 and 100),
 status text check(status in ('scored','dnf','dns')),score numeric,
 foreign key(club_id,event_id,game_id) references public.training_games(club_id,event_id,id) on delete cascade,
 check((status='scored' and score is not null) or (status is distinct from 'scored' and score is null))
);
create unique index training_game_team_name on public.training_game_teams(game_id,lower(trim(name)));
alter table public.training_game_teams enable row level security;
grant select on public.training_game_teams to authenticated;
create policy game_teams_read on public.training_game_teams for select to authenticated using(public.has_club_role(club_id,array['owner','coach']));
-- Existing mutations become private helpers. Public individual calls cannot alter team games.
alter function public.save_training_game(uuid,uuid,uuid,text,text,text,uuid[],integer) rename to apply_training_game;
revoke all on function public.apply_training_game(uuid,uuid,uuid,text,text,text,uuid[],integer) from public,anon,authenticated;
create function public.save_training_game(target_club uuid,target_event uuid,target_game uuid,label text,kind text,details text,entrants uuid[],expected_revision integer default null) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 perform 1 from public.events where id=target_event and club_id=target_club for update;
 if exists(select 1 from public.training_games where id=target_game and mode='teams') then raise exception 'Týmovou minihru upravte přes týmovou soupisku.';end if;
 perform public.apply_training_game(target_club,target_event,target_game,label,kind,details,entrants,expected_revision);
end $$;
alter function public.set_training_game_score(uuid,uuid,uuid,integer,text,numeric) rename to apply_training_game_score;
revoke all on function public.apply_training_game_score(uuid,uuid,uuid,integer,text,numeric) from public,anon,authenticated;
create function public.set_training_game_score(target_club uuid,target_game uuid,target_member uuid,expected_revision integer,result_status text,result_score numeric) returns void language plpgsql security definer set search_path=public as $$
declare eid uuid;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select event_id into eid from public.training_games where id=target_game and club_id=target_club;
 perform 1 from public.events where id=eid and club_id=target_club for update;
 if exists(select 1 from public.training_games where id=target_game and mode='teams') then raise exception 'Zapište společný výsledek týmu.';end if;
 perform public.apply_training_game_score(target_club,target_game,target_member,expected_revision,result_status,result_score);
end $$;

create function public.save_team_training_game(target_club uuid,target_event uuid,target_game uuid,label text,kind text,details text,teams jsonb,expected_revision integer) returns void language plpgsql security definer set search_path=public as $$
declare entrants uuid[];t jsonb;team_id uuid;ids uuid[];old_team public.training_game_teams;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 perform 1 from public.events where id=target_event and club_id=target_club for update;
 if jsonb_typeof(teams)<>'array' or jsonb_array_length(teams) not between 1 and 20 then raise exception 'Vyberte 1–20 týmů.';end if;
 if exists(select 1 from jsonb_array_elements(teams) x where jsonb_typeof(x->'member_ids') is distinct from 'array' or length(trim(x->>'name')) not between 1 and 80 or x->>'id' is null) then raise exception 'Vyplňte názvy a účastníky týmů.';end if;
 select array_agg(m::uuid) into entrants from jsonb_array_elements(teams) x cross join lateral jsonb_array_elements_text(x->'member_ids') m;
 if entrants is null or cardinality(entrants) not between 1 and 100 or cardinality(entrants)<>(select count(distinct m) from unnest(entrants) m) then raise exception 'Účastník může být právě v jednom týmu; vyberte 1–100 účastníků.';end if;
 if (select count(distinct x->>'id') from jsonb_array_elements(teams) x)<>jsonb_array_length(teams) or (select count(distinct lower(trim(x->>'name'))) from jsonb_array_elements(teams) x)<>jsonb_array_length(teams) then raise exception 'Týmy musí mít různé názvy a ID.';end if;
 if exists(select 1 from public.training_games where id=target_game and mode='individual') then raise exception 'Uložený způsob soutěže nelze měnit; vytvořte novou minihru.';end if;
 perform public.apply_training_game(target_club,target_event,target_game,label,kind,details,entrants,expected_revision);
 update public.training_games set mode='teams' where id=target_game;
 delete from public.training_game_teams where game_id=target_game and not(id in (select (x->>'id')::uuid from jsonb_array_elements(teams) x));
 for t in select * from jsonb_array_elements(teams) loop
  team_id:=(t->>'id')::uuid;select array_agg(m::uuid order by m) into ids from jsonb_array_elements_text(t->'member_ids') m;
  if ids is null or cardinality(ids)=0 then raise exception 'Tým musí mít účastníka.';end if;
  select * into old_team from public.training_game_teams where id=team_id for update;
  if found and (old_team.game_id<>target_game or old_team.club_id<>target_club) then raise exception 'Tým nepatří do této minihry.';end if;
  if old_team.id is not null and old_team.member_ids is distinct from ids then
   update public.training_game_entries set status=null,score=null where game_id=target_game and member_id=any(ids);
  end if;
  insert into public.training_game_teams(id,club_id,event_id,game_id,name,member_ids,status,score)
  values(team_id,target_club,target_event,target_game,trim(t->>'name'),ids,case when old_team.member_ids=ids then old_team.status else null end,case when old_team.member_ids=ids then old_team.score else null end)
  on conflict(id) do update set name=excluded.name,member_ids=excluded.member_ids,status=excluded.status,score=excluded.score;
 end loop;
 -- Preserve a score only when the exact saved team remains unchanged.
 update public.training_game_entries e set status=t.status,score=t.score from public.training_game_teams t where e.game_id=target_game and t.game_id=e.game_id and e.member_id=any(t.member_ids);
end $$;
create function public.set_training_game_team_score(target_club uuid,target_game uuid,target_team uuid,expected_revision integer,result_status text,result_score numeric) returns void language plpgsql security definer set search_path=public as $$
declare g public.training_games;t public.training_game_teams;m uuid;rev integer;eid uuid;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select event_id into eid from public.training_games where id=target_game and club_id=target_club;
 perform 1 from public.events where id=eid and club_id=target_club for update;
 select * into g from public.training_games where id=target_game and club_id=target_club and mode='teams' for update;
 if not found or expected_revision is null or g.revision<>expected_revision then raise exception 'Minihra se mezitím změnila. Obnovte přehled.';end if;
 select * into t from public.training_game_teams where id=target_team and game_id=g.id and club_id=target_club for update;
 if not found then raise exception 'Tým není v této minihře.';end if;
 -- The private existing scorer checks time, score bounds and actual attendance for every player.
 foreach m in array t.member_ids loop
  select revision into rev from public.training_games where id=g.id;
  perform public.apply_training_game_score(target_club,g.id,m,rev,result_status,result_score);
 end loop;
 update public.training_game_teams set status=result_status,score=result_score where id=t.id;
end $$;
revoke all on function public.save_training_game(uuid,uuid,uuid,text,text,text,uuid[],integer),public.set_training_game_score(uuid,uuid,uuid,integer,text,numeric),public.save_team_training_game(uuid,uuid,uuid,text,text,text,jsonb,integer),public.set_training_game_team_score(uuid,uuid,uuid,integer,text,numeric) from public,anon;
grant execute on function public.save_training_game(uuid,uuid,uuid,text,text,text,uuid[],integer),public.set_training_game_score(uuid,uuid,uuid,integer,text,numeric),public.save_team_training_game(uuid,uuid,uuid,text,text,text,jsonb,integer),public.set_training_game_team_score(uuid,uuid,uuid,integer,text,numeric) to authenticated;
commit;
