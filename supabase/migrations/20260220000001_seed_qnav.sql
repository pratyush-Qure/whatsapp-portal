-- Seed Qnav project: templates, triggers, groups, members, trigger_groups.
-- Safe to run after 20260218000001_seed_demo_data (ensures qnav project exists).
-- Twilio is configured via env only; no per-project accounts.

-- Qnav project id (from seed_demo_data)
-- d0000000-0000-4000-8000-000000000002

-- 1. Templates (Qnav – healthcare / Qure-themed)
INSERT INTO public.templates (id, project_id, name, version, category, language, header_type, body, footer, twilio_status)
SELECT * FROM (VALUES
  ('b0000000-0000-4000-8000-000000000010'::uuid, 'd0000000-0000-4000-8000-000000000002'::uuid, 'appointment_reminder', 1, 'utility', 'en', 'none',
   'Hello {{1}}, this is a reminder for your appointment on {{2}} at {{3}}. Please reply YES to confirm or contact us to reschedule.', NULL, 'draft'),
  ('b0000000-0000-4000-8000-000000000011'::uuid, 'd0000000-0000-4000-8000-000000000002'::uuid, 'screening_followup', 1, 'utility', 'en', 'none',
   'Hi {{1}}, your screening follow-up is scheduled for {{2}}. Visit {{3}} for more details. Reply with any questions.', 'Qure.ai – AI for healthcare', 'draft'),
  ('b0000000-0000-4000-8000-000000000012'::uuid, 'd0000000-0000-4000-8000-000000000002'::uuid, 'result_ready', 1, 'utility', 'en', 'none',
   'Hello {{1}}, your results are ready. Reference: {{2}}. Log in to the portal to view. Contact support if you need help.', NULL, 'draft'),
  ('b0000000-0000-4000-8000-000000000013'::uuid, 'd0000000-0000-4000-8000-000000000002'::uuid, 'otp_verification', 1, 'authentication', 'en', 'none',
   'Your verification code is {{1}}. Valid for 10 minutes. Do not share this code.', NULL, 'draft')
) AS t(id, project_id, name, version, category, language, header_type, body, footer, twilio_status)
ON CONFLICT (project_id, name, version) DO NOTHING;

-- 2. Template variables for Qnav templates
INSERT INTO public.template_variables (template_id, position, name, type, source, payload_path, required)
SELECT t.id, v.pos, v.n, v.ty, 'payload', v.path, true
FROM public.templates t
CROSS JOIN (VALUES (1, 'var_1', 'text', 'patient_name'), (2, 'var_2', 'text', 'appointment_date'), (3, 'var_3', 'text', 'appointment_time')) AS v(pos, n, ty, path)
WHERE t.project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND t.name = 'appointment_reminder' AND t.version = 1
  AND NOT EXISTS (SELECT 1 FROM public.template_variables tv WHERE tv.template_id = t.id AND tv.position = v.pos);

INSERT INTO public.template_variables (template_id, position, name, type, source, payload_path, required)
SELECT t.id, v.pos, v.n, v.ty, 'payload', v.path, true
FROM public.templates t
CROSS JOIN (VALUES (1, 'var_1', 'text', 'patient_name'), (2, 'var_2', 'text', 'followup_date'), (3, 'var_3', 'url', 'portal_url')) AS v(pos, n, ty, path)
WHERE t.project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND t.name = 'screening_followup' AND t.version = 1
  AND NOT EXISTS (SELECT 1 FROM public.template_variables tv WHERE tv.template_id = t.id AND tv.position = v.pos);

INSERT INTO public.template_variables (template_id, position, name, type, source, payload_path, required)
SELECT t.id, v.pos, v.n, v.ty, 'payload', v.path, true
FROM public.templates t
CROSS JOIN (VALUES (1, 'var_1', 'text', 'patient_name'), (2, 'var_2', 'text', 'reference_id')) AS v(pos, n, ty, path)
WHERE t.project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND t.name = 'result_ready' AND t.version = 1
  AND NOT EXISTS (SELECT 1 FROM public.template_variables tv WHERE tv.template_id = t.id AND tv.position = v.pos);

INSERT INTO public.template_variables (template_id, position, name, type, source, payload_path, required)
SELECT t.id, 1, 'var_1', 'text', 'payload', 'otp_code', true
FROM public.templates t
WHERE t.project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND t.name = 'otp_verification' AND t.version = 1
  AND NOT EXISTS (SELECT 1 FROM public.template_variables tv WHERE tv.template_id = t.id);

-- 3. Triggers (Qnav; Twilio from env only)
INSERT INTO public.triggers (id, project_id, slug, name, source_type, template_id, status, recipient_path)
SELECT
  'c0000000-0000-4000-8000-000000000010'::uuid,
  'd0000000-0000-4000-8000-000000000002'::uuid,
  'appointment_reminder',
  'Appointment Reminder',
  'webhook',
  (SELECT id FROM public.templates WHERE project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND name = 'appointment_reminder' AND version = 1 LIMIT 1),
  'active',
  'phone'
WHERE EXISTS (SELECT 1 FROM public.templates WHERE project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND name = 'appointment_reminder' LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.triggers WHERE project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND slug = 'appointment_reminder');

INSERT INTO public.triggers (id, project_id, slug, name, source_type, template_id, status, recipient_path)
SELECT
  'c0000000-0000-4000-8000-000000000011'::uuid,
  'd0000000-0000-4000-8000-000000000002'::uuid,
  'screening_followup',
  'Screening Follow-up',
  'webhook',
  (SELECT id FROM public.templates WHERE project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND name = 'screening_followup' AND version = 1 LIMIT 1),
  'active',
  'phone'
WHERE EXISTS (SELECT 1 FROM public.templates WHERE project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND name = 'screening_followup' LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.triggers WHERE project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND slug = 'screening_followup');

INSERT INTO public.triggers (id, project_id, slug, name, source_type, template_id, status, recipient_path)
SELECT
  'c0000000-0000-4000-8000-000000000012'::uuid,
  'd0000000-0000-4000-8000-000000000002'::uuid,
  'result_ready',
  'Result Ready',
  'webhook',
  (SELECT id FROM public.templates WHERE project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND name = 'result_ready' AND version = 1 LIMIT 1),
  'active',
  'phone'
WHERE EXISTS (SELECT 1 FROM public.templates WHERE project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND name = 'result_ready' LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.triggers WHERE project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND slug = 'result_ready');

-- 4. Groups (Qnav)
INSERT INTO public.groups (id, project_id, name, slug, description)
SELECT * FROM (VALUES
  ('e0000000-0000-4000-8000-000000000001'::uuid, 'd0000000-0000-4000-8000-000000000002'::uuid, 'TB Screening Cohort', 'tb-screening', 'Patients in TB screening follow-up'),
  ('e0000000-0000-4000-8000-000000000002'::uuid, 'd0000000-0000-4000-8000-000000000002'::uuid, 'Appointment Reminders', 'appointment-reminders', 'Patients with upcoming appointments'),
  ('e0000000-0000-4000-8000-000000000003'::uuid, 'd0000000-0000-4000-8000-000000000002'::uuid, 'Results Notifications', 'results-notifications', 'Patients awaiting results')
) AS t(id, project_id, name, slug, description)
ON CONFLICT (project_id, slug) DO NOTHING;

-- 5. Group members (sample users/recipients)
INSERT INTO public.group_members (group_id, phone, name)
SELECT g.id, m.phone, m.name
FROM public.groups g
CROSS JOIN (VALUES
  ('+15551110001', 'Alex Carter'),
  ('+15551110002', 'Sam Johnson'),
  ('+15551110003', 'Jordan Lee')
) AS m(phone, name)
WHERE g.project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND g.slug = 'tb-screening'
  AND NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = g.id AND gm.phone = m.phone);

INSERT INTO public.group_members (group_id, phone, name)
SELECT g.id, m.phone, m.name
FROM public.groups g
CROSS JOIN (VALUES
  ('+15552220001', 'Casey Brown'),
  ('+15552220002', 'Riley Davis')
) AS m(phone, name)
WHERE g.project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND g.slug = 'appointment-reminders'
  AND NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = g.id AND gm.phone = m.phone);

INSERT INTO public.group_members (group_id, phone, name)
SELECT g.id, m.phone, m.name
FROM public.groups g
CROSS JOIN (VALUES
  ('+15553330001', 'Morgan White'),
  ('+15553330002', 'Alex Carter')
) AS m(phone, name)
WHERE g.project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND g.slug = 'results-notifications'
  AND NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = g.id AND gm.phone = m.phone);

-- 6. Trigger–group mapping and default trigger per group
INSERT INTO public.trigger_groups (trigger_id, group_id)
SELECT tr.id, gr.id
FROM public.triggers tr
JOIN public.groups gr ON gr.project_id = tr.project_id
WHERE tr.project_id = 'd0000000-0000-4000-8000-000000000002'::uuid
  AND (
    (tr.slug = 'screening_followup' AND gr.slug = 'tb-screening')
    OR (tr.slug = 'appointment_reminder' AND gr.slug = 'appointment-reminders')
    OR (tr.slug = 'result_ready' AND gr.slug = 'results-notifications')
  )
ON CONFLICT (trigger_id, group_id) DO NOTHING;

UPDATE public.groups
SET default_trigger_id = (SELECT id FROM public.triggers WHERE project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND slug = 'screening_followup' LIMIT 1)
WHERE project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND slug = 'tb-screening';

UPDATE public.groups
SET default_trigger_id = (SELECT id FROM public.triggers WHERE project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND slug = 'appointment_reminder' LIMIT 1)
WHERE project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND slug = 'appointment-reminders';

UPDATE public.groups
SET default_trigger_id = (SELECT id FROM public.triggers WHERE project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND slug = 'result_ready' LIMIT 1)
WHERE project_id = 'd0000000-0000-4000-8000-000000000002'::uuid AND slug = 'results-notifications';
