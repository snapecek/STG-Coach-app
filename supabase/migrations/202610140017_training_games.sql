begin;
create table public.training_games(
 id uuid primary key default gen_random_uuid(),club_id uuid not null,event_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 80),
 scoring text not null check(scoring in ('time','repetitions','distance','points')),
 notes text not null default '' check(length(notes)<=2000),revision integer not null default 1,
 unique(club_id,event_id,id),foreign key(club_id,event_id) references public.events(club_id,id) on delete cascade
);
create table public.training_game_entries(
 club_id uuid not null,event_id uuid not null,game_id uuid not null,member_id uuid not null,
 status text check(status in ('scored','dnf','dns')),score numeric(14,3),
 primary key(game_id,member_id),
 foreign key(club_id,event_id,game_id) references public.training_games(club_id,event_id,id) on delete cascade,
 foreign key(club_id,member_id) references public.members(club_id,id) on delete cascade,
 foreign key(event_id,member_id) references public.participation(event_id,member_id) on delete cascade,
 check(((status='scored' and score is not null) or ((status is null or status in ('dnf','dns')) and score is null)) is true)
);
alter table public.training_games enable row level security;
alter table public.training_game_entries enable row level security;
revoke all on public.training_games,public.training_game_entries from public,anon,authenticated;
grant select on public.training_games,public.training_game_entries to authenticated;
create policy training_games_staff on public.training_games for select to authenticated using(public.has_club_role(club_id,array['owner','coach']));
create policy training_game_entries_staff on public.training_game_entries for select to authenticated using(public.has_club_role(club_id,array['owner','coach']));
create function public.reopen_training_game() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.events set completed_at=null,completed_by=null where id=case when tg_op='DELETE' then old.event_id else new.event_id end;
 return null;
end $$;
create trigger training_game_review after insert or update or delete on public.training_games for each row execute function public.reopen_training_game();
create function public.review_training_game_entry() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='DELETE' and not exists(select 1 from public.members where id=old.member_id) then return old;end if;
 update public.training_games set revision=revision+1 where id=case when tg_op='DELETE' then old.game_id else new.game_id end;
 return null;
end $$;
create trigger training_game_entry_review after insert or update or delete on public.training_game_entries for each row execute function public.review_training_game_entry();
create function public.save_training_game(target_club uuid,target_event uuid,target_game uuid,label text,kind text,details text,entrants uuid[],expected_revision integer default null) returns void language plpgsql security definer set search_path=public as $$
declare e public.events;g public.training_games;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select * into e from public.events where id=target_event and club_id=target_club and event_kind='training' and status='scheduled' for update;
 if not found then raise exception 'Minihry patří jen do plánovaného tréninku.';end if;
 if label is null or length(trim(label)) not between 1 and 80 or kind is null or kind not in ('time','repetitions','distance','points') or details is null or length(details)>2000 or entrants is null or cardinality(entrants) not between 1 and 100 or cardinality(entrants)<>(select count(distinct m) from unnest(entrants) m) then raise exception 'Zkontrolujte název, typ a 1–100 různých účastníků.';end if;
 if exists(select 1 from unnest(entrants) as selected(member_id) where not exists(select 1 from public.members m where m.id=selected.member_id and m.club_id=target_club and ((not e.roster_only and (m.removed_at is null or m.removed_at>e.starts_at)) or exists(select 1 from public.participation p where p.event_id=e.id and p.member_id=m.id)))) then raise exception 'Účastník není v soupisce tréninku.';end if;
 select * into g from public.training_games where id=target_game and club_id=target_club and event_id=e.id for update;
 if found then
  if expected_revision is null or g.revision<>expected_revision then raise exception 'Minihra se mezitím změnila. Obnovte přehled.';end if;
  if g.scoring<>kind then raise exception 'Typ uložené minihry nelze měnit. Vytvořte novou minihru.';end if;
  update public.training_games set name=trim(label),notes=trim(details),revision=revision+1 where id=g.id;
  delete from public.training_game_entries where game_id=g.id and not(member_id=any(entrants));
 else
  if expected_revision is not null then raise exception 'Minihra už neexistuje. Obnovte přehled.';end if;
  if (select count(*) from public.training_games where event_id=e.id)>=20 then raise exception 'Nejvýše 20 miniher v jednom tréninku.';end if;
  insert into public.training_games(id,club_id,event_id,name,scoring,notes) values(target_game,target_club,e.id,trim(label),kind,trim(details));
 end if;
 -- Whole-club trainings may not have RSVP rows yet. Add only missing roster rows.
 insert into public.participation(club_id,event_id,member_id) select target_club,e.id,m from unnest(entrants) m on conflict(event_id,member_id) do nothing;
 insert into public.training_game_entries(club_id,event_id,game_id,member_id) select target_club,e.id,target_game,m from unnest(entrants) m on conflict(game_id,member_id) do nothing;
end $$;
create function public.set_training_game_score(target_club uuid,target_game uuid,target_member uuid,expected_revision integer,result_status text,result_score numeric) returns void language plpgsql security definer set search_path=public as $$
declare g public.training_games;eid uuid;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select event_id into eid from public.training_games where id=target_game and club_id=target_club;
 perform 1 from public.events where id=eid and club_id=target_club and event_kind='training' and status='scheduled' and starts_at<=now() for update;
 if not found then raise exception 'Výsledek vyžaduje zahájený trénink.';end if;
 select * into g from public.training_games where id=target_game and club_id=target_club for update;
 if not found or expected_revision is null or g.revision<>expected_revision then raise exception 'Minihra se mezitím změnila. Obnovte přehled.';end if;
 if result_status is not null and result_status not in ('scored','dnf','dns') then raise exception 'Neplatný stav výsledku.';end if;
 if result_status='scored' then
  if result_score is null or result_score::text in ('NaN','Infinity','-Infinity') then raise exception 'Vyplňte výsledek.';end if;
  if (g.scoring='time' and (result_score not between 1 and 172800000 or result_score<>trunc(result_score))) or (g.scoring='repetitions' and (result_score not between 0 and 1000000000 or result_score<>trunc(result_score))) or (g.scoring='distance' and (result_score not between 0 and 1000000 or result_score<>round(result_score,3))) or (g.scoring='points' and (result_score not between -1000000000 and 1000000000 or result_score<>trunc(result_score))) then raise exception 'Výsledek neodpovídá typu minihry nebo povolenému rozsahu.';end if;
 elsif result_score is not null then raise exception 'Nezapsaný výsledek, DNF a DNS nemají hodnotu.';end if;
 if result_status is not null and not exists(select 1 from public.participation p where p.club_id=target_club and p.event_id=g.event_id and p.member_id=target_member and p.attended is not distinct from (result_status<>'dns') and (result_status='dns' or not p.attendance_excused)) then raise exception 'Nejprve potvrďte odpovídající skutečnou docházku.';end if;
 update public.training_game_entries set status=result_status,score=result_score where game_id=g.id and member_id=target_member;
 if not found then raise exception 'Účastník není v soupisce minihry.';end if;
end $$;
create function public.delete_training_game(target_club uuid,target_game uuid,expected_revision integer) returns void language plpgsql security definer set search_path=public as $$
declare eid uuid;
begin
 if not public.has_club_role(target_club,array['owner','coach']) then raise insufficient_privilege;end if;
 select event_id into eid from public.training_games where id=target_game and club_id=target_club;
 perform 1 from public.events where id=eid and club_id=target_club and event_kind='training' and status='scheduled' for update;
 if not found then raise exception 'Minihra není dostupná.';end if;
 delete from public.training_games where id=target_game and club_id=target_club and revision=expected_revision;
 if not found then raise exception 'Minihra se mezitím změnila. Obnovte přehled.';end if;
end $$;
create function public.guard_training_game_kind() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.event_kind<>'training' and exists(select 1 from public.training_games where event_id=new.id) then raise exception 'Nejprve odeberte tréninkové minihry.';end if;
 return new;
end $$;
create trigger training_game_kind before update of event_kind on public.events for each row execute function public.guard_training_game_kind();
revoke all on function public.reopen_training_game(),public.review_training_game_entry(),public.guard_training_game_kind(),public.save_training_game(uuid,uuid,uuid,text,text,text,uuid[],integer),public.set_training_game_score(uuid,uuid,uuid,integer,text,numeric),public.delete_training_game(uuid,uuid,integer) from public,anon;
grant execute on function public.save_training_game(uuid,uuid,uuid,text,text,text,uuid[],integer),public.set_training_game_score(uuid,uuid,uuid,integer,text,numeric),public.delete_training_game(uuid,uuid,integer) to authenticated;
commit;
