-- Run after migration 044, deploying remind-rsvp, and configuring Edge secrets/Vault.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$begin
 if not exists(select 1 from vault.decrypted_secrets where name='trenomi_rsvp_email_url' and decrypted_secret ~ '^https://[a-z0-9]+[.]supabase[.]co/functions/v1/remind-rsvp$') then raise exception 'Create Vault secret trenomi_rsvp_email_url (full HTTPS Edge Function URL) first';end if;
 if not exists(select 1 from vault.decrypted_secrets where name='trenomi_push_dispatch_secret' and length(decrypted_secret)>=32) then raise exception 'Create Vault secret trenomi_push_dispatch_secret, matching PUSH_DISPATCH_SECRET in Edge secrets, first';end if;
end $$;
select cron.unschedule(jobid) from cron.job where jobname='trenomi-member-rsvp-email';
select cron.schedule('trenomi-member-rsvp-email','* * * * *',$job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='trenomi_rsvp_email_url'),
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='trenomi_push_dispatch_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=95000
 );
$job$);
