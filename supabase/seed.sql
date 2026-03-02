-- Portal user (pratyush.khandelwal@qure.ai / Qure@12345) is created by migration 20260218000002_seed_portal_user.sql.
-- Add any extra seed data below if needed.

-- Queue cron: URL for pg_cron + pg_net to call your app (local dev: from DB container to host app)
INSERT INTO public.app_cron_config (key, value) VALUES
  ('process_queue_url', 'http://host.docker.internal:3001/api/cron/process-queue')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
