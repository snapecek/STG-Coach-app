-- Run AFTER migration 040, Edge Function deployment and Vault setup (docs/COACH_PUSH.md).
-- No secrets belong in this file or in the cron command text.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$begin
 if not exists(select 1 from vault.decrypted_secrets where name='trenomi_push_url' and decrypted_secret like 'https://%/functions/v1/push-rsvp') then raise exception 'Create Vault secret trenomi_push_url (full HTTPS Edge Function URL) first';end if;
 if not exists(select 1 from vault.decrypted_secrets where name='trenomi_push_dispatch_secret' and length(decrypted_secret)>=32) then raise exception 'Create Vault secret trenomi_push_dispatch_secret first';end if;
end $$;
select cron.unschedule(jobid) from cron.job where jobname='trenomi-coach-rsvp-push';
select cron.schedule('trenomi-coach-rsvp-push','* * * * *',$job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='trenomi_push_url'),
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='trenomi_push_dispatch_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=95000
 );
$job$);
