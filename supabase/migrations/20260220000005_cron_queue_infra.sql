-- Queue infra: pg_cron + pg_net so the database can trigger the app's process-queue endpoint.
-- Same migration runs locally and on hosted Supabase; production move = set process_queue_url and go.
--
-- Local: if pg_cron jobs don't run, ensure your Supabase CLI image has pg_cron (and cron worker).
-- Fallback: leave process_queue_url empty and use Vercel Cron or a dev script that curls the endpoint.

-- 1. Extensions (pg_cron: schedule; pg_net: HTTP from DB to your app)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN
  NULL; -- pg_net not available on some local images; app can still use Vercel/external cron
END
$$;

-- 2. Config table: URL of your app's cron endpoint (env-specific, no env vars in SQL)
CREATE TABLE IF NOT EXISTS public.app_cron_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

COMMENT ON TABLE public.app_cron_config IS 'Config for DB-driven cron: process_queue_url = full URL to GET /api/cron/process-queue. Set per environment (local vs hosted).';

ALTER TABLE public.app_cron_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage app_cron_config" ON public.app_cron_config
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Authenticated users can read app_cron_config" ON public.app_cron_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 3. Function: call process-queue endpoint via pg_net (no-op if URL unset or pg_net missing)
CREATE OR REPLACE FUNCTION public.trigger_process_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  url text;
BEGIN
  SELECT value INTO url FROM public.app_cron_config WHERE key = 'process_queue_url' LIMIT 1;
  IF url IS NULL OR trim(url) = '' THEN
    RETURN;
  END IF;
  PERFORM net.http_get(
    url := url,
    timeout_milliseconds := 55000
  );
EXCEPTION WHEN OTHERS THEN
  NULL; -- pg_net missing or request failed; avoid breaking cron
END;
$$;

COMMENT ON FUNCTION public.trigger_process_queue() IS 'Calls the app process-queue endpoint via pg_net. Used by pg_cron every minute.';

-- 4. Schedule: every minute (same as Vercel cron)
SELECT cron.schedule(
  'process-queue',
  '* * * * *',
  $$SELECT public.trigger_process_queue()$$
);

-- Optional: unschedule if you prefer only external cron (e.g. Vercel):
-- SELECT cron.unschedule('process-queue');
