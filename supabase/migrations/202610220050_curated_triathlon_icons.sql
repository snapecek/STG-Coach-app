-- Approved TRI 4 with TRI 1 swimmer; retire exactly the 20 highlighted icons.
begin;
-- Reset decorative choices only. Event content, attendance and review stay intact.
update public.templates set training_icon=null where training_icon in ('medal','fencing','archery','nutrition','hurdles','throwing','rowing-pair','high-jump','shot-put','pool','stadium','weightlifting','diving','gym-bag','whistle','gymnastics','bench','golf','steeplechase','podium');
update public.events set training_icon=null where training_icon in ('medal','fencing','archery','nutrition','hurdles','throwing','rowing-pair','high-jump','shot-put','pool','stadium','weightlifting','diving','gym-bag','whistle','gymnastics','bench','golf','steeplechase','podium');
alter table public.templates drop constraint templates_training_icon_check;
alter table public.templates add constraint templates_training_icon_check check(training_icon in ('running','stopwatch','swimming','dumbbell','wrestling','bench-press','cycling','tennis','football','hurdle-jump','track','martial-arts','skipping','road-cycling','rowing','rugby','water-polo','table-tennis','hiking','equestrian','ocr','trail','triathlon','none'));
alter table public.events drop constraint events_training_icon_check;
alter table public.events add constraint events_training_icon_check check(training_icon in ('running','stopwatch','swimming','dumbbell','wrestling','bench-press','cycling','tennis','football','hurdle-jump','track','martial-arts','skipping','road-cycling','rowing','rugby','water-polo','table-tennis','hiking','equestrian','ocr','trail','triathlon','none'));
create function public.triathlon_icons_ready() returns boolean language sql stable security invoker set search_path=public,pg_temp as $$select auth.uid() is not null$$;
revoke all on function public.triathlon_icons_ready() from public,anon;
grant execute on function public.triathlon_icons_ready() to authenticated;
commit;
