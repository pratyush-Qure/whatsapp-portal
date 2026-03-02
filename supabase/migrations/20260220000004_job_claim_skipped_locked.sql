-- Claim next job with FOR UPDATE SKIP LOCKED so multiple workers don't take the same job.
-- Call from cron/worker; returns one job row or null. Non-negotiable for multi-instance safety (per prompt).

CREATE OR REPLACE FUNCTION public.claim_next_job()
RETURNS SETOF public.job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_id uuid;
BEGIN
  SELECT id INTO row_id
  FROM public.job_queue
  WHERE status = 'pending'
    AND scheduled_for <= now()
    AND attempts < COALESCE(max_attempts, 3)
  ORDER BY scheduled_for ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF row_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.job_queue
  SET
    status = 'processing',
    started_at = now(),
    attempts = COALESCE(attempts, 0) + 1,
    updated_at = now()
  WHERE id = row_id;

  RETURN QUERY
  SELECT * FROM public.job_queue WHERE id = row_id;
END;
$$;

COMMENT ON FUNCTION public.claim_next_job() IS 'Claims one pending job with FOR UPDATE SKIP LOCKED; use from worker to avoid duplicate processing.';
