-- Check the real upgrade from the previous whitelist, not a simulated reset.
do $$begin
 if (select count(*) from public.templates where club_id='2fff0000-0000-4000-8000-000000000001' and training_icon is null)<>20 then raise exception 'FAIL retired template choices not reset';end if;
 if (select count(*) from public.events where club_id='2fff0000-0000-4000-8000-000000000001' and training_icon is null)<>20 then raise exception 'FAIL retired event choices not reset';end if;
 if (select count(*) from public.events where club_id='2fff0000-0000-4000-8000-000000000001' and completed_at is not null and actual_notes='Zachovaný zápis' and actual_duration_minutes=45 and plan='Původní plán')<>22 then raise exception 'FAIL icon cleanup changed completion or content';end if;
 if (select count(*) from public.events where club_id='2fff0000-0000-4000-8000-000000000001' and training_icon in ('swimming','none'))<>2 then raise exception 'FAIL retained choices were changed';end if;
 if (select count(*) from public.participation where club_id='2fff0000-0000-4000-8000-000000000001' and attended and response='yes')<>22 then raise exception 'FAIL icon cleanup changed attendance';end if;
end $$;
delete from public.events where club_id='2fff0000-0000-4000-8000-000000000001';
delete from public.templates where club_id='2fff0000-0000-4000-8000-000000000001';
delete from public.members where club_id='2fff0000-0000-4000-8000-000000000001';
delete from public.club_roles where club_id='2fff0000-0000-4000-8000-000000000001';
delete from public.clubs where id='2fff0000-0000-4000-8000-000000000001';
delete from auth.users where id='1fff0000-0000-4000-8000-000000000001';
