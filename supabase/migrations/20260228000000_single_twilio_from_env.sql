-- Single Twilio account from environment: remove per-project twilio_accounts.
-- Twilio is configured via TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER only.

ALTER TABLE public.triggers
  DROP CONSTRAINT IF EXISTS triggers_twilio_account_id_fkey;

ALTER TABLE public.triggers
  DROP COLUMN IF EXISTS twilio_account_id;

DROP TABLE IF EXISTS public.twilio_accounts;
