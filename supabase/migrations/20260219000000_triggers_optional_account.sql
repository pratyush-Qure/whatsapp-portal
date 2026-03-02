-- Messaging account is configured via .env / code; triggers no longer require per-trigger account selection.
ALTER TABLE public.triggers
  ALTER COLUMN twilio_account_id DROP NOT NULL;

COMMENT ON COLUMN public.triggers.twilio_account_id IS 'Optional: specific account to use. When null, env-based config (e.g. TWILIO_*) is used.';
