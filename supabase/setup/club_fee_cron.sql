-- Run after migration 042 if the UI reports that the scheduler is not running.
-- No Edge Function, Vault entries or private keys are needed.
create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(jobid) from cron.job where jobname='trenomi-monthly-club-fees';
select cron.schedule('trenomi-monthly-club-fees','0 * * * *','select public.run_club_fee_recurring();');
