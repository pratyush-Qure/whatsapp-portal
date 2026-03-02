# WhatsApp Messaging Portal — Architecture

Trigger-driven WhatsApp messaging platform built on Next.js 15, Supabase, and Twilio. This document describes the full architecture: layers, data model, message path, APIs, security, and deployment.

---

## 1. High-Level Architecture

### 1.1 Logical Layers

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT / EXTERNAL SYSTEMS                              │
│  Portal UI (Next.js)  │  Webhook callers  │  Cron (Vercel)                        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS APPLICATION (Vercel)                             │
│  • App Router: Dashboard, Triggers, Templates, Groups, Send, Queue, Analytics   │
│  • API: /api/v1/* (CRUD, inbound webhooks, invoke, analytics, Twilio webhook)   │
│  • Cron: /api/cron/process-queue (inbound queue + job queue + template sync)    │
│  • Auth: Supabase Auth + middleware + RLS                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          ▼                             ▼                             ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   SUPABASE       │         │   QUEUE LAYER    │         │  CHANNEL LAYER   │
│   • PostgreSQL   │         │   • job_queue    │         │  • Twilio (WA)   │
│   • Auth         │         │   • inbound_     │         │  • sendMessage() │
│   • Realtime     │         │     webhook_queue│         │  • Content API   │
└──────────────────┘         └──────────────────┘         └──────────────────┘
          │                             │                             │
          │                             │                             ▼
          │                             │                  ┌──────────────────┐
          │                             │                  │  TWILIO API      │
          │                             │                  │  • Send message │
          │                             │                  │  • Status hook   │
          └─────────────────────────────┴───────────────────┴──────────────────┘
```

- **No Redis/BullMQ**: Queue is Supabase-only (`job_queue`, `inbound_webhook_queue`). Worker runs via **pg_cron + pg_net** (DB calls your app) or **Vercel Cron** (same endpoint); same code path either way.
- **Channel abstraction**: `src/lib/channels/` — `sendMessage(provider, accountId, params)`. Twilio is the only provider today; adding another = new provider + optional `channel_provider` on triggers.

### 1.2 Message Path (End-to-End)

1. **Webhook received** — `POST /api/v1/inbound/{project_slug}/{trigger_slug}` or `/batch`.
2. **Return 200 immediately** — No auth required for inbound webhooks.
3. **Queue for processing** — Payload inserted into `inbound_webhook_queue`. Idempotency key stored; duplicate keys ignored (unique constraint).
4. **Cron processes inbound queue** — `/api/cron/process-queue` runs: first `processInboundWebhookQueue(50)`, then job worker. For each pending inbound row: check idempotency inside `dispatchMessage`, create `message_logs`, push to `job_queue` (one job per recipient).
5. **Worker picks up job** — `claim_next_job()` RPC (FOR UPDATE SKIP LOCKED) or fallback select; then: opt-out check, optional rate limit (`MESSAGING_MAX_UNIQUE_RECIPIENTS_24H`), template approval check, Twilio send (Content SID or body), update `message_logs` and `job_queue`.
6. **Twilio status callback** — Delivery updates (sent, delivered, read, failed) → `POST /api/v1/webhooks/twilio` → update `message_logs`.
7. **Dead letter** — Jobs with `status = 'failed'` and `attempts >= max_attempts` remain in `job_queue`; no separate DLQ table. Retry via `POST /api/v1/jobs/[id]/retry`.

---

## 2. Tech Stack

| Layer        | Choice                          |
|-------------|----------------------------------|
| Frontend    | Next.js 15 (App Router), React 18, TailwindCSS |
| Backend     | Next.js API Routes, Supabase (PostgreSQL, Auth, Realtime) |
| WhatsApp    | Twilio API for WhatsApp (Content Templates, status callbacks) |
| Queue       | Supabase tables + pg_cron/pg_net (local/hosted) or Vercel Cron (no Redis) |
| Deployment  | Vercel (recommended)             |
| Auth        | Supabase Auth + RLS             |

---

## 3. Data Model

### Twilio: single account from environment

The app uses **one Twilio account for the whole portal**, configured via environment variables:

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`

**Projects are for organization only** (e.g. grouping triggers, templates, groups). They are not used for different Twilio accounts. The `twilio_accounts` table exists in the schema from an earlier design but is **not used**; all sending and Content API calls use the env credentials. Settings shows a read-only view of the env-derived account.

### Core Tables

| Table                 | Purpose |
|-----------------------|--------|
| **projects**          | Organizational root; slug in webhook URL. Not used for per-project Twilio. |
| **templates**         | Per project; name, category, language, body, header/footer, buttons; twilio_status (draft/pending/approved/rejected), twilio_content_sid, twilio_rejected_reason. |
| **template_variables**| Per template; position, name, type, payload_path, source (payload/static/computed), required. |
| **triggers**          | Per project; slug, name, template_id, recipient_path, conditions (JSON), status (active/paused/draft), http_method (default POST), signature_secret. |
| **groups**            | Per project; name, optional default_trigger_id. |
| **group_members**     | phone, name, extra JSON; used when invoking by group. |
| **trigger_groups**    | Links triggers to groups (many-to-many). |
| **message_logs**      | One per message; trigger_id, template_id, recipient_phone, status (queued → sent → delivered/read/failed), twilio_message_sid, sent_at, delivered_at, failed_at, error_code, error_message. |
| **job_queue**         | status (pending/processing/completed/failed), payload (message_log_id, recipient_phone, resolved_variables), attempts, max_attempts, scheduled_for. Claimed via `claim_next_job()` RPC (FOR UPDATE SKIP LOCKED). |
| **inbound_webhook_queue** | project_slug, trigger_slug, kind (single/batch), payload, idempotency_key, status; processed by cron before job_queue. |
| **opt_outs**          | project_id, phone, opted_out_at, source; STOP handling and dispatcher skip. |
| **scheduled_recurring** | Optional; recurring schedule config. |
| **app_cron_config**     | key/value for DB-driven cron; `process_queue_url` = full URL to GET /api/cron/process-queue (set per env). |

Full schema and indexes: `supabase/migrations/`.

### 3.1 Queue infra (local → production)

The same queue tables and `/api/cron/process-queue` logic run everywhere. Only **who triggers** the endpoint differs:

| Environment | Trigger | Notes |
|-------------|--------|--------|
| **Local** | **pg_cron + pg_net** (migration `20260220000005_cron_queue_infra.sql`) | DB calls `process_queue_url` every minute. Seed sets URL to `http://host.docker.internal:3001/api/cron/process-queue`. If your app port differs, update `app_cron_config.process_queue_url`. |
| **Hosted Supabase** | **pg_cron + pg_net** (same migration) | After deploy: set `process_queue_url` to your app URL (e.g. `https://yourapp.vercel.app/api/cron/process-queue`) in `app_cron_config`. No code change. |
| **Vercel-only** | **Vercel Cron** (`vercel.json` → `GET /api/cron/process-queue`) | Leave `process_queue_url` empty; Vercel hits the endpoint on schedule. Same endpoint, same code. |

Extensions: **pg_cron** (schedule) and **pg_net** (HTTP from DB). If pg_net is missing locally, the scheduled job no-ops; use Vercel cron or a small dev script that curls the endpoint every minute.

---

## 4. API Endpoints

### Auth & Me
- Supabase Auth (login/sign-out). No separate auth API in app.
- **GET /api/v1/me** — Current user.

### Projects
- **GET/POST /api/v1/projects**

### Templates
- **GET/POST /api/v1/templates**
- **GET/PUT/DELETE /api/v1/templates/[id]**
- **POST /api/v1/templates/[id]/submit** — Create Twilio Content, submit for WhatsApp approval.
- **GET /api/v1/templates/[id]/approval-status** — Fetch status from Twilio, update template.
- Delete allowed only when `twilio_status` is `draft` or `rejected`; response includes 30-day name reuse warning.

### Triggers
- **GET/POST /api/v1/triggers**
- **GET/PUT/DELETE /api/v1/triggers/[id]**
- **POST /api/v1/triggers/[id]/invoke** — mode: one_number / selected_groups / everyone; phone or group_ids; optional payload.
- **POST /api/v1/triggers/[id]/test** — Test send (single recipient).
- **GET /api/v1/triggers/[id]/groups** — Groups linked to trigger.

### Groups
- **GET/POST /api/v1/groups**
- **GET/PUT/DELETE /api/v1/groups/[id]**
- **GET/POST/DELETE /api/v1/groups/[id]/members**, **/api/v1/groups/[id]/members/[memberId]**

### Inbound (Webhooks)
- **GET /api/v1/inbound/[slug]/[triggerSlug]** — Synchronous dispatch (legacy; GET with query params).
- **POST /api/v1/inbound/[slug]/[triggerSlug]** — Insert into inbound_webhook_queue → return 200. Auth: X-System-Key or X-WA-Portal-Signature. Body: JSON with recipient path (e.g. phone) + template variables; optional idempotency_key.
- **POST /api/v1/inbound/[slug]/[triggerSlug]/batch** — Same auth; body: `{ "payloads": [ {...}, ... ] }` (max 100). One queue row (kind batch); cron expands to one dispatch per payload.

### Jobs & Queue
- **GET /api/v1/jobs** — List job_queue (filter by status, trigger).
- **GET /api/v1/jobs/[id]**
- **POST /api/v1/jobs/[id]/retry** — Re-enqueue failed job.

### Analytics
- **GET /api/v1/analytics/overview** — Aggregates, time series (project-scoped).
- **GET /api/v1/analytics/[triggerId]/funnel** — Sent/delivered/read/failed by trigger.
- **GET /api/v1/analytics/events** — Raw events (if implemented).

### Compliance & Config
- **GET /api/v1/opt-outs?project_id=...** — List opt-outs.
- **GET /api/v1/messaging/rate-limit?project_id=...** — unique_recipients_last_24h + note.

### Webhooks (Twilio)
- **POST /api/v1/webhooks/twilio** — Inbound messages (STOP → opt_outs) and status callbacks (update message_logs by twilio_message_sid).

### Cron
- **GET /api/cron/process-queue** — No auth. Runs: processInboundWebhookQueue(50), processNextJob() loop, recurring (if any), syncPendingTemplatesApprovalStatus(20).

### Twilio Accounts
- **GET/POST /api/v1/twilio-accounts** — Project-scoped; encrypt auth_token with ENCRYPTION_KEY.

---

## 5. Security

- **Auth**: Supabase Auth; middleware protects portal routes; redirect to `/unauthorized` when unauthenticated.
- **RLS**: Row Level Security on all tables; service role for cron and server-side admin.
- **Webhooks**: No auth required for inbound POST/GET; callers can hit the URL directly.
- **Messaging provider**: Set `MESSAGING_PROVIDER` (twilio | gupshup | whatsapp_business); default is twilio. Provider-specific env vars (e.g. TWILIO_*, GUPSHUP_*) are read from the environment; Settings shows a read-only view. Single account per deployment; no webhook/cron secrets.
- **Logging**: Never log full phone numbers; use `maskPhoneForLog(phone)` (e.g. +91XXXXX12345). Content SID validated (`^HX[a-fA-F0-9]{32}$`) before use.

---

## 6. Template Approval & Compliance

- **Content API**: Create template in Twilio Content, submit for WhatsApp approval, poll approval status. Stored: `twilio_content_sid`, `twilio_status`, `twilio_rejected_reason`.
- **Sending**: Worker and dispatcher require `twilio_status === 'approved'`; otherwise job fails / dispatch skips with clear error.
- **Opt-out**: Table `opt_outs`; dispatcher checks before creating message_log. Inbound STOP (stop/unsubscribe/cancel/end/quit) → upsert opt_outs by project (resolved from Twilio To).
- **Rate limit**: Optional `MESSAGING_MAX_UNIQUE_RECIPIENTS_24H`; worker checks distinct recipients in last 24h for project; if ≥ limit, reschedules job in 1h.
- **Send logs**: Every send creates/updates `message_logs`; Twilio status callback updates delivery (sent, delivered, read, failed).

---

## 7. Key Code Paths

| Concern              | Location |
|----------------------|----------|
| Inbound POST (single/batch) | `src/app/api/v1/inbound/[slug]/[triggerSlug]/route.ts`, `.../batch/route.ts` |
| Inbound queue processor    | `src/lib/inbound/process-queue.ts` |
| Dispatch (resolve trigger, template, vars, opt-out, create log + job) | `src/lib/engine/dispatcher.ts` |
| Job worker (claim, opt-out, rate limit, template check, send) | `src/lib/queue/worker.ts` |
| Job claim (FOR UPDATE SKIP LOCKED) | `supabase/migrations/..._job_claim_skipped_locked.sql` → `claim_next_job()` RPC |
| Twilio send / Content API  | `src/lib/channels/twilio-provider.ts`, `src/lib/twilio/client.ts`, `src/lib/twilio/content.ts` |
| Twilio webhook (status + STOP) | `src/app/api/v1/webhooks/twilio/route.ts` |
| Template sync (approval status) | `src/lib/templates/sync-approval-status.ts` |
| Cron entrypoint              | `src/app/api/cron/process-queue/route.ts` |

---

## 8. Environment Variables

| Variable | Purpose |
|----------|---------|
| **NEXT_PUBLIC_SUPABASE_URL**, **NEXT_PUBLIC_SUPABASE_ANON_KEY** | Supabase client. |
| **SUPABASE_SERVICE_ROLE_KEY** | Server-side and cron. |
| **TWILIO_ACCOUNT_SID**, **TWILIO_AUTH_TOKEN** | Fallback when trigger has no account (optional). |
| **NEXT_PUBLIC_APP_URL** | Base URL for webhooks and status callback. |
| **MESSAGING_PROVIDER** | twilio \| gupshup \| whatsapp_business; default twilio. Determines which env vars are read. |
| **TWILIO_ACCOUNT_SID**, **TWILIO_AUTH_TOKEN**, **TWILIO_WHATSAPP_NUMBER** | When provider is twilio. |
| **GUPSHUP_APP_ID**, **GUPSHUP_APP_TOKEN**, **GUPSHUP_SENDER** | When provider is gupshup (stub; implement in channels). |
| **WAB_ACCESS_TOKEN**, **WAB_PHONE_NUMBER_ID** | When provider is whatsapp_business (stub). |
| **MESSAGING_PROJECT_ID** | Optional; project UUID for inbound STOP opt-out (when using env-only messaging). |
| **MESSAGING_MAX_UNIQUE_RECIPIENTS_24H** | Optional; cap unique recipients per project per 24h. |

---

## 9. Deployment

- **Vercel**: Deploy Next.js; set env vars; enable cron (e.g. `* * * * *` for `/api/cron/process-queue` in `vercel.json`).
- **Supabase**: Create project; run migrations; enable pg_cron (and pg_net if used). No Redis required.
- **Twilio**: Configure WhatsApp sender; set status callback URL to `{NEXT_PUBLIC_APP_URL}/api/v1/webhooks/twilio`.

---

## 10. User Flows (Summary)

- **Login** → `/login` (Supabase Auth); redirect to dashboard or `/unauthorized`.
- **Projects** → List/create/select project; project-scoped tabs (Dashboard, Triggers, Templates, Groups, Send, Queue, Analytics).
- **Templates** → Create/edit; submit for WhatsApp approval; sync status; delete only when draft/rejected (30-day name reuse warning).
- **Groups** → Create groups; add members (phone, name); link groups to triggers.
- **Triggers** → Create trigger (template, Twilio account, recipient_path, conditions); link groups; show webhook URL; invoke (one number / selected groups / everyone); test send.
- **Send** → Bulk send (trigger + payloads) or use webhook from external systems.
- **Queue** → View jobs; retry failed.
- **Analytics** → Overview and per-trigger funnel (sent/delivered/read/failed).
- **Settings** → Twilio (read-only; shows account derived from env vars).

External: **POST** to inbound URL with payload → 200 immediately → cron processes queue → jobs run → Twilio sends → status callback updates logs.
