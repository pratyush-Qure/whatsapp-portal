-- Inbound webhook queue: receive webhook → verify → insert → return 200.
-- Cron processes pending rows (idempotency + dispatch to job_queue).
-- No additional infra; all in Supabase.

CREATE TABLE public.inbound_webhook_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_slug TEXT NOT NULL,
  trigger_slug TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('single', 'batch')),
  payload JSONB NOT NULL,
  idempotency_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_inbound_webhook_queue_status ON public.inbound_webhook_queue(status);
CREATE INDEX idx_inbound_webhook_queue_created_at ON public.inbound_webhook_queue(created_at ASC);

-- Avoid duplicate processing for same idempotency key (single/batch per trigger)
CREATE UNIQUE INDEX idx_inbound_webhook_queue_idempotency
  ON public.inbound_webhook_queue (project_slug, trigger_slug, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key != '';

ALTER TABLE public.inbound_webhook_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage inbound_webhook_queue" ON public.inbound_webhook_queue
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE public.inbound_webhook_queue IS 'Webhook payloads to process async: verify → return 200, then cron runs idempotency + dispatch.';
