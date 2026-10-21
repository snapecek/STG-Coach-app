-- Approved OCR 2 (monkey bars) and Trail 1 (uphill runner).
begin;
alter table public.templates drop constraint templates_training_icon_check;
alter table public.templates add constraint templates_training_icon_check check(training_icon in ('running','medal','fencing','stopwatch','swimming','dumbbell','archery','wrestling','nutrition','bench-press','cycling','hurdles','throwing','tennis','rowing-pair','football','high-jump','hurdle-jump','shot-put','track','pool','stadium','martial-arts','weightlifting','skipping','road-cycling','diving','rowing','gym-bag','whistle','rugby','water-polo','gymnastics','bench','golf','table-tennis','steeplechase','hiking','podium','equestrian','none','ocr','trail'));
alter table public.events drop constraint events_training_icon_check;
alter table public.events add constraint events_training_icon_check check(training_icon in ('running','medal','fencing','stopwatch','swimming','dumbbell','archery','wrestling','nutrition','bench-press','cycling','hurdles','throwing','tennis','rowing-pair','football','high-jump','hurdle-jump','shot-put','track','pool','stadium','martial-arts','weightlifting','skipping','road-cycling','diving','rowing','gym-bag','whistle','rugby','water-polo','gymnastics','bench','golf','table-tennis','steeplechase','hiking','podium','equestrian','none','ocr','trail'));
create function public.special_sport_icons_ready() returns boolean language sql stable security invoker set search_path=public,pg_temp as $$select auth.uid() is not null$$;
revoke all on function public.special_sport_icons_ready() from public,anon;
grant execute on function public.special_sport_icons_ready() to authenticated;
commit;
