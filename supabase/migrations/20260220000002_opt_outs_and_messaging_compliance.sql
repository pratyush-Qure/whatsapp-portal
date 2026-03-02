-- Opt-out list: users who replied STOP (or equivalent). Never send to them again.
-- Required for WhatsApp policy and compliance (DPDP, GDPR).
CREATE TABLE public.opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT DEFAULT 'inbound' CHECK (source IN ('inbound', 'manual', 'import')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, phone)
);
CREATE INDEX idx_opt_outs_project_id ON public.opt_outs(project_id);
CREATE INDEX idx_opt_outs_phone ON public.opt_outs(phone);
CREATE INDEX idx_opt_outs_project_phone ON public.opt_outs(project_id, phone);
ALTER TABLE public.opt_outs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view opt_outs" ON public.opt_outs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can manage opt_outs" ON public.opt_outs FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Service role can manage opt_outs" ON public.opt_outs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE public.opt_outs IS 'Recipients who opted out (e.g. replied STOP). Do not send to these numbers.';
