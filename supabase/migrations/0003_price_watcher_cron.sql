-- Price Watcher pg_cron setup
--
-- Draait elk uur op het hele uur. De Edge Function zelf bepaalt welke
-- price_watches 'aan beurt' zijn o.b.v. check_interval_hours.
--
-- VEREISTE HANDMATIGE STAP voor je deze migration uitrolt:
--   1. Ga naar Supabase Dashboard → Project Settings → Vault
--   2. Voeg een secret toe met name='service_role_key', value=<jouw service role key>
--
-- Daarna kun je deze migration toepassen. De cron job haalt de key op uit Vault
-- zodat we hem niet in de cron SQL hoeven te hardcoden.

-- Verwijder een eventueel bestaand schedule met dezelfde naam (idempotent).
SELECT cron.unschedule('price-watcher-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'price-watcher-hourly'
);

-- Schedule elk uur op minuut 0.
SELECT cron.schedule(
  'price-watcher-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ffifhjwjauvhohmhhbip.supabase.co/functions/v1/price-watcher',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Inspectie:
--   SELECT jobname, schedule, active FROM cron.job;
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
