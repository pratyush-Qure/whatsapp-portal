-- Recurring message schedules: one row per (trigger + recipient). Processed by cron.
CREATE TABLE public.scheduled_recurring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  trigger_id UUID NOT NULL REFERENCES public.triggers(id) ON DELETE CASCADE,
  recipient_payload JSONB NOT NULL,
  recurrence_type TEXT NOT NULL CHECK (recurrence_type IN ('daily', 'weekly')),
  time_of_day TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  end_type TEXT NOT NULL CHECK (end_type IN ('until_date', 'after_count', 'never')),
  end_date TIMESTAMPTZ,
  end_after_count INTEGER,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_recurring_next_run ON public.scheduled_recurring(next_run_at)
  WHERE status = 'active';
CREATE INDEX idx_scheduled_recurring_project ON public.scheduled_recurring(project_id);
ALTER TABLE public.scheduled_recurring ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view scheduled_recurring" ON public.scheduled_recurring FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can manage scheduled_recurring" ON public.scheduled_recurring FOR ALL USING (auth.uid() IS NOT NULL);
CREATE TRIGGER update_scheduled_recurring_updated_at BEFORE UPDATE ON public.scheduled_recurring
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
