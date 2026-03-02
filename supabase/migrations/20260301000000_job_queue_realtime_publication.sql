-- Ensure job_queue changes are available via Supabase Realtime postgres_changes.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.job_queue;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN undefined_object THEN
    -- Publication may not exist in some environments; worker still has polling fallback.
    NULL;
END
$$;
