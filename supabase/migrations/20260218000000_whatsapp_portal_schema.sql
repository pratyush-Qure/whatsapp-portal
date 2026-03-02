-- WhatsApp Portal - Clean HLD Schema
-- Single migration: projects, triggers, templates, message_logs, job_queue.
-- Replaces all legacy pharma/notification schemas.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. projects (top-level grouping: Qnav, Default, etc.)
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_projects_slug ON public.projects(slug);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view projects" ON public.projects FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can manage projects" ON public.projects FOR ALL USING (auth.uid() IS NOT NULL);
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. twilio_accounts (per project)
CREATE TABLE public.twilio_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_sid TEXT NOT NULL UNIQUE,
  auth_token_encrypted TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  phone_number_sid TEXT NOT NULL UNIQUE,
  status_callback_url TEXT,
  rate_limit_per_sec INTEGER NOT NULL DEFAULT 80,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_twilio_accounts_project_id ON public.twilio_accounts(project_id);
CREATE INDEX idx_twilio_accounts_is_active ON public.twilio_accounts(is_active);
ALTER TABLE public.twilio_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view twilio accounts" ON public.twilio_accounts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can manage twilio accounts" ON public.twilio_accounts FOR ALL USING (auth.uid() IS NOT NULL);
CREATE TRIGGER update_twilio_accounts_updated_at BEFORE UPDATE ON public.twilio_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. templates (per project)
CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL CHECK (category IN ('utility', 'marketing', 'authentication')),
  language TEXT NOT NULL DEFAULT 'en',
  header_type TEXT CHECK (header_type IN ('none', 'text', 'image', 'video', 'document')),
  header_content TEXT,
  body TEXT NOT NULL,
  footer TEXT,
  buttons_json JSONB DEFAULT '[]'::jsonb,
  twilio_status TEXT NOT NULL DEFAULT 'draft' CHECK (twilio_status IN ('draft', 'pending', 'approved', 'rejected')),
  twilio_content_sid TEXT UNIQUE,
  twilio_rejected_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name, version)
);
CREATE INDEX idx_templates_project_id ON public.templates(project_id);
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view templates" ON public.templates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can manage templates" ON public.templates FOR ALL USING (auth.uid() IS NOT NULL);
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. template_variables
CREATE TABLE public.template_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'number', 'date', 'url', 'phone')),
  source TEXT NOT NULL CHECK (source IN ('payload', 'static', 'computed')),
  payload_path TEXT,
  static_value TEXT,
  compute_expr TEXT,
  required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, position)
);
CREATE INDEX idx_template_variables_template_id ON public.template_variables(template_id);
ALTER TABLE public.template_variables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view template variables" ON public.template_variables FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can manage template variables" ON public.template_variables FOR ALL USING (auth.uid() IS NOT NULL);

-- 5. triggers (per project)
CREATE TABLE public.triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('webhook', 'cron', 'api', 'event', 'manual')),
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  template_id UUID REFERENCES public.templates(id) ON DELETE RESTRICT,
  twilio_account_id UUID REFERENCES public.twilio_accounts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'paused', 'draft')),
  conditions_json JSONB,
  recipient_path TEXT NOT NULL DEFAULT 'phone',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, slug)
);
CREATE INDEX idx_triggers_project_id ON public.triggers(project_id);
CREATE INDEX idx_triggers_status ON public.triggers(status);
ALTER TABLE public.triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view triggers" ON public.triggers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can manage triggers" ON public.triggers FOR ALL USING (auth.uid() IS NOT NULL);
CREATE TRIGGER update_triggers_updated_at BEFORE UPDATE ON public.triggers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. message_logs (delivery tracking)
CREATE TABLE public.message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID NOT NULL REFERENCES public.triggers(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE RESTRICT,
  recipient_phone TEXT NOT NULL,
  twilio_message_sid TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'undelivered')),
  resolved_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_message_logs_trigger_id ON public.message_logs(trigger_id);
CREATE INDEX idx_message_logs_status ON public.message_logs(status);
CREATE INDEX idx_message_logs_created_at ON public.message_logs(created_at DESC);
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view message logs" ON public.message_logs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Service role can manage message logs" ON public.message_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role' OR auth.uid() IS NOT NULL);
CREATE TRIGGER update_message_logs_updated_at BEFORE UPDATE ON public.message_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. trigger_parameter_sets (predefined payloads per trigger)
CREATE TABLE public.trigger_parameter_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID NOT NULL REFERENCES public.triggers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  params_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_trigger_parameter_sets_trigger_id ON public.trigger_parameter_sets(trigger_id);
ALTER TABLE public.trigger_parameter_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view parameter sets" ON public.trigger_parameter_sets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can manage parameter sets" ON public.trigger_parameter_sets FOR ALL USING (auth.uid() IS NOT NULL);

-- 8. job_queue (async send queue)
CREATE TABLE public.job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID NOT NULL REFERENCES public.triggers(id),
  message_log_id UUID REFERENCES public.message_logs(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payload JSONB NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_job_queue_status ON public.job_queue(status);
CREATE INDEX idx_job_queue_trigger_id ON public.job_queue(trigger_id);
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage job queue" ON public.job_queue
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role' OR auth.uid() IS NOT NULL);
CREATE TRIGGER update_job_queue_updated_at BEFORE UPDATE ON public.job_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
