-- Group-level trigger: each group can have one default trigger (template flow) for sending to that group
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS default_trigger_id UUID REFERENCES public.triggers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_groups_default_trigger_id ON public.groups(default_trigger_id);
