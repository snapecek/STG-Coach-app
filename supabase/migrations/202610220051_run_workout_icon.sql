-- Approved BC4 running + pull-ups; extend decorative choices without changing data.
begin;
alter table public.templates drop constraint templates_training_icon_check;
alter table public.templates add constraint templates_training_icon_check check(training_icon in ('running','stopwatch','swimming','dumbbell','wrestling','bench-press','cycling','tennis','football','hurdle-jump','track','martial-arts','skipping','road-cycling','rowing','rugby','water-polo','table-tennis','hiking','equestrian','ocr','trail','triathlon','run-workout','none'));
alter table public.events drop constraint events_training_icon_check;
alter table public.events add constraint events_training_icon_check check(training_icon in ('running','stopwatch','swimming','dumbbell','wrestling','bench-press','cycling','tennis','football','hurdle-jump','track','martial-arts','skipping','road-cycling','rowing','rugby','water-polo','table-tennis','hiking','equestrian','ocr','trail','triathlon','run-workout','none'));
create function public.run_workout_icons_ready() returns boolean language sql stable security invoker set search_path=public,pg_temp as $$select auth.uid() is not null$$;
revoke all on function public.run_workout_icons_ready() from public,anon;
grant execute on function public.run_workout_icons_ready() to authenticated;
commit;
