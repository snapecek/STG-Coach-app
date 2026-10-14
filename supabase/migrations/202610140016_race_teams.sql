begin;
create table public.race_teams(
 id uuid primary key default gen_random_uuid(),club_id uuid not null,event_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 80),category text not null default '' check(length(category)<=80),
 status text check(status in ('finished','dnf','dns')),elapsed_ms integer,notes text not null default '' check(length(notes)<=1000),
 revision integer not null default 1,
 unique(club_id,event_id,id),
 foreign key(club_id,event_id) references public.events(club_id,id) on delete cascade,
 check(((status='finished' and elapsed_ms between 1 and 172800000 and elapsed_ms is not null) or ((status is null or status in ('dnf','dns')) and elapsed_ms is null)) is true)
);
create unique index race_team_name on public.race_teams(event_id,lower(trim(name)));
create table public.race_team_members(
 club_id uuid not null,event_id uuid not null,team_id uuid not null,member_id uuid not null,
 primary key(event_id,member_id),
 foreign key(club_id,event_id,team_id) references public.race_teams(club_id,event_id,id) on delete cascade,
 foreign key(club_id,member_id) references public.members(club_id,id) on delete cascade,
 foreign key(event_id,member_id) references public.participation(event_id,member_id) on delete cascade
);
alter table public.race_teams enable row level security;
alter table public.race_team_members enable row level security;
revoke all on public.race_teams,public.race_team_members from public,anon,authenticated;
grant select on public.race_teams,public.race_team_members to authenticated;
create policy race_teams_staff on public.race_teams for select to authenticated using(public.has_club_role(club_id,array['owner','coach']));
create policy race_team_members_staff on public.race_team_members for select to authenticated using(public.has_club_role(club_id,array['owner','coach']));
create function public.reopen_race_team() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.events set completed_at=null,completed_by=null where id=case when tg_op='DELETE' then old.event_id else new.event_id end;
 return null;
end $$;
create trigger race_team_review after insert or update or delete on public.race_teams for each row execute function public.reopen_race_team();
create function public.invalidate_race_team_roster() returns trigger language plpgsql security definer set search_path=public as $$
begin
 -- Member retention erases personal links without reopening historical results.
 if tg_op='DELETE' and not exists(select 1 from public.members where id=old.member_id) then return old;end if;
 update public.race_teams set status=null,elapsed_ms=null,revision=revision+1 where id=case when tg_op='DELETE' then old.team_id else new.team_id end;
 return null;
end $$;
create trigger race_team_roster_review after insert or delete on public.race_team_members for each row execute function public.invalidate_race_team_roster();
create function public.save_race_team(target_club uuid,target_event uuid,target_team uuid,label text,division text,entrants uuid[],expected_revision integer default null) returns void language plpgsql security definer set search_path=public as $$
declare t public.race_teams; old_members uuid[]; new_members uuid[];
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 perform 1 from public.events where club_id=target_club and id=target_event and event_kind='race' and status='scheduled' for update;
 if not found then raise exception 'Týmy lze upravovat jen u plánovaného závodu.';end if;
 if label is null or length(trim(label)) not between 1 and 80 or division is null or length(division)>80 or entrants is null or cardinality(entrants) not between 1 and 50 or cardinality(entrants)<>(select count(distinct m) from unnest(entrants) m) then raise exception 'Vyplňte název a vyberte 1–50 různých závodníků.';end if;
 if exists(select 1 from unnest(entrants) m where not exists(select 1 from public.participation p where p.club_id=target_club and p.event_id=target_event and p.member_id=m)) then raise exception 'Závodník není v soupisce tohoto závodu.';end if;
 if exists(select 1 from public.race_team_members m where m.event_id=target_event and m.member_id=any(entrants) and m.team_id<>target_team) then raise exception 'Závodník už patří do jiného týmu.';end if;
 select * into t from public.race_teams where id=target_team and club_id=target_club and event_id=target_event for update;
 if found then
  if expected_revision is null or t.revision<>expected_revision then raise exception 'Tým se mezitím změnil. Obnovte přehled.';end if;
  select array_agg(member_id order by member_id) into old_members from public.race_team_members where team_id=t.id;
  select array_agg(m order by m) into new_members from unnest(entrants) m;
  update public.race_teams set name=trim(label),category=trim(division),revision=revision+1 where id=t.id;
  if old_members is not distinct from new_members then return;end if;
  delete from public.race_team_members where team_id=t.id;
 else
  if expected_revision is not null then raise exception 'Tým už neexistuje. Obnovte přehled.';end if;
  if (select count(*) from public.race_teams where event_id=target_event)>=50 then raise exception 'Nejvýše 50 týmů v jednom závodě.';end if;
  insert into public.race_teams(id,club_id,event_id,name,category) values(target_team,target_club,target_event,trim(label),trim(division));
 end if;
 insert into public.race_team_members(club_id,event_id,team_id,member_id) select target_club,target_event,target_team,m from unnest(entrants) m;
end $$;
create function public.set_race_team_result(target_club uuid,target_team uuid,expected_revision integer,result_status text,result_ms integer,details text) returns void language plpgsql security definer set search_path=public as $$
declare t public.race_teams; eid uuid;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select event_id into eid from public.race_teams where id=target_team and club_id=target_club;
 perform 1 from public.events where id=eid and club_id=target_club and event_kind='race' and status='scheduled' and starts_at<=now() for update;
 if not found then raise exception 'Výsledek vyžaduje zahájený závod.';end if;
 select * into t from public.race_teams where id=target_team and club_id=target_club for update;
 if not found or expected_revision is null or t.revision<>expected_revision then raise exception 'Tým se mezitím změnil. Obnovte přehled.';end if;
 if details is null or length(details)>1000 or (result_status is not null and result_status not in ('finished','dnf','dns')) or (result_status='finished' and (result_ms is null or result_ms not between 1 and 172800000)) or (result_status is distinct from 'finished' and result_ms is not null) then raise exception 'Zkontrolujte stav a čas týmu.';end if;
 if result_status is not null and (not exists(select 1 from public.race_team_members where team_id=t.id) or exists(select 1 from public.race_team_members m join public.participation p on p.event_id=m.event_id and p.member_id=m.member_id where m.team_id=t.id and (p.attended is distinct from (result_status<>'dns') or (p.attendance_excused and result_status<>'dns')))) then raise exception 'Potvrďte docházku všech členů týmu; DNS vyžaduje nepřítomnost, ostatní stavy přítomnost.';end if;
 update public.race_teams set status=result_status,elapsed_ms=result_ms,notes=trim(details),revision=revision+1 where id=t.id;
end $$;
create function public.delete_race_team(target_club uuid,target_team uuid,expected_revision integer) returns void language plpgsql security definer set search_path=public as $$
declare eid uuid;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select event_id into eid from public.race_teams where club_id=target_club and id=target_team;
 perform 1 from public.events where id=eid and club_id=target_club and status='scheduled' and event_kind='race' for update;
 if not found then raise exception 'Tým není dostupný.';end if;
 delete from public.race_teams where id=target_team and club_id=target_club and revision=expected_revision;
 if not found then raise exception 'Tým se mezitím změnil. Obnovte přehled.';end if;
end $$;
create function public.guard_race_team_completion() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.event_kind<>'race' and exists(select 1 from public.race_teams where event_id=new.id) then raise exception 'Nejprve odeberte závodní týmy.';end if;
 if new.event_kind='race' and new.completed_at is not null and exists(select 1 from public.race_teams t where t.event_id=new.id and (t.status is null or not exists(select 1 from public.race_team_members m where m.team_id=t.id) or exists(select 1 from public.race_team_members m join public.participation p on p.event_id=m.event_id and p.member_id=m.member_id where m.team_id=t.id and (p.attended is distinct from (t.status<>'dns') or (p.attendance_excused and t.status<>'dns'))))) then raise exception 'Doplňte týmové výsledky a odpovídající docházku.';end if;
 return new;
end $$;
create trigger race_team_completion before update of completed_at,event_kind on public.events for each row execute function public.guard_race_team_completion();
revoke all on function public.reopen_race_team(),public.invalidate_race_team_roster(),public.guard_race_team_completion(),public.save_race_team(uuid,uuid,uuid,text,text,uuid[],integer),public.set_race_team_result(uuid,uuid,integer,text,integer,text),public.delete_race_team(uuid,uuid,integer) from public,anon;
grant execute on function public.save_race_team(uuid,uuid,uuid,text,text,uuid[],integer),public.set_race_team_result(uuid,uuid,integer,text,integer,text),public.delete_race_team(uuid,uuid,integer) to authenticated;
commit;
