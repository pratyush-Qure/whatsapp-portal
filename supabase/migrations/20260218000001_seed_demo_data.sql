-- Seed demo projects, templates, triggers.
-- Safe to run multiple times (uses ON CONFLICT / existence checks).
-- Twilio is configured via env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER) only.

-- 1. Projects
INSERT INTO public.projects (id, name, slug, description) VALUES
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'Default', 'default', 'Default project for demo data'),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'Qnav', 'qnav', 'QNav-specific triggers and templates')
ON CONFLICT (slug) DO NOTHING;

-- 2. Templates (Default project)
INSERT INTO public.templates (id, project_id, name, version, category, language, header_type, body, footer, twilio_status)
SELECT * FROM (VALUES
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'd0000000-0000-4000-8000-000000000001'::uuid, 'order_confirmation', 1, 'utility', 'en', 'none',
   'Hi {{1}}, your order {{2}} has been confirmed! Total: {{3}}. We will notify you when it ships.', 'Thank you for shopping with us.', 'draft'),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'd0000000-0000-4000-8000-000000000001'::uuid, 'appointment_reminder', 1, 'utility', 'en', 'none',
   'Hello {{1}}, this is a reminder for your appointment on {{2}} at {{3}}. Reply YES to confirm or CANCEL to reschedule.', NULL, 'draft'),
  ('b0000000-0000-4000-8000-000000000003'::uuid, 'd0000000-0000-4000-8000-000000000001'::uuid, 'welcome_message', 1, 'marketing', 'en', 'none',
   'Welcome {{1}}! Thanks for signing up. Use code {{2}} for 10% off your first order.', 'Reply STOP to unsubscribe.', 'draft'),
  ('b0000000-0000-4000-8000-000000000004'::uuid, 'd0000000-0000-4000-8000-000000000001'::uuid, 'otp_verification', 1, 'authentication', 'en', 'none',
   'Your verification code is {{1}}. Valid for 10 minutes. Do not share this code.', NULL, 'draft')
) AS t(id, project_id, name, version, category, language, header_type, body, footer, twilio_status)
ON CONFLICT (project_id, name, version) DO NOTHING;

-- 3. Template variables
INSERT INTO public.template_variables (template_id, position, name, type, source, payload_path, required)
SELECT t.id, v.pos, v.n, v.ty, 'payload', v.path, true
FROM public.templates t
CROSS JOIN (VALUES (1, 'var_1', 'text', 'customer_name'), (2, 'var_2', 'text', 'order_id'), (3, 'var_3', 'text', 'total')) AS v(pos, n, ty, path)
WHERE t.name = 'order_confirmation' AND t.version = 1
  AND NOT EXISTS (SELECT 1 FROM public.template_variables tv WHERE tv.template_id = t.id AND tv.position = v.pos);

INSERT INTO public.template_variables (template_id, position, name, type, source, payload_path, required)
SELECT t.id, v.pos, v.n, v.ty, 'payload', v.path, true
FROM public.templates t
CROSS JOIN (VALUES (1, 'var_1', 'text', 'customer_name'), (2, 'var_2', 'text', 'appointment_date'), (3, 'var_3', 'text', 'appointment_time')) AS v(pos, n, ty, path)
WHERE t.name = 'appointment_reminder' AND t.version = 1
  AND NOT EXISTS (SELECT 1 FROM public.template_variables tv WHERE tv.template_id = t.id AND tv.position = v.pos);

INSERT INTO public.template_variables (template_id, position, name, type, source, payload_path, required)
SELECT t.id, v.pos, v.n, v.ty, 'payload', v.path, true
FROM public.templates t
CROSS JOIN (VALUES (1, 'var_1', 'text', 'customer_name'), (2, 'var_2', 'text', 'promo_code')) AS v(pos, n, ty, path)
WHERE t.name = 'welcome_message' AND t.version = 1
  AND NOT EXISTS (SELECT 1 FROM public.template_variables tv WHERE tv.template_id = t.id AND tv.position = v.pos);

INSERT INTO public.template_variables (template_id, position, name, type, source, payload_path, required)
SELECT t.id, 1, 'var_1', 'text', 'payload', 'otp_code', true
FROM public.templates t
WHERE t.name = 'otp_verification' AND t.version = 1
  AND NOT EXISTS (SELECT 1 FROM public.template_variables tv WHERE tv.template_id = t.id);

-- 4. Sample triggers (Twilio from env only)
INSERT INTO public.triggers (id, project_id, slug, name, source_type, template_id, status, recipient_path)
SELECT
  'c0000000-0000-4000-8000-000000000001'::uuid,
  'd0000000-0000-4000-8000-000000000001'::uuid,
  'order_confirmed',
  'Order Confirmation',
  'webhook',
  (SELECT id FROM public.templates WHERE name = 'order_confirmation' AND version = 1 AND project_id = 'd0000000-0000-4000-8000-000000000001'::uuid LIMIT 1),
  'draft',
  'phone'
WHERE EXISTS (SELECT 1 FROM public.templates WHERE name = 'order_confirmation' LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.triggers WHERE slug = 'order_confirmed' AND project_id = 'd0000000-0000-4000-8000-000000000001'::uuid);

INSERT INTO public.triggers (id, project_id, slug, name, source_type, template_id, status, recipient_path)
SELECT
  'c0000000-0000-4000-8000-000000000002'::uuid,
  'd0000000-0000-4000-8000-000000000001'::uuid,
  'appointment_reminder',
  'Appointment Reminder',
  'webhook',
  (SELECT id FROM public.templates WHERE name = 'appointment_reminder' AND version = 1 AND project_id = 'd0000000-0000-4000-8000-000000000001'::uuid LIMIT 1),
  'draft',
  'phone'
WHERE EXISTS (SELECT 1 FROM public.templates WHERE name = 'appointment_reminder' LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.triggers WHERE slug = 'appointment_reminder' AND project_id = 'd0000000-0000-4000-8000-000000000001'::uuid);
