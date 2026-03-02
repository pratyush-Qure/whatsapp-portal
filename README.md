# WhatsApp Messaging Portal

Trigger-driven WhatsApp messaging platform built with **Next.js 15**, **Supabase**, and **Twilio**. Configure templates and triggers, send messages via webhooks or the portal UI, and track delivery with built-in analytics.

**Full architecture, data model, APIs, and deployment:** [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Features

- **Templates** — Create WhatsApp templates with variables; submit for Meta/WhatsApp approval via Twilio Content API.
- **Triggers** — Webhook-based or manual; map payload fields to template variables; link groups for bulk send.
- **Queue** — Supabase-backed job queue processed by Vercel Cron; opt-out handling, rate limits, retries.
- **Compliance** — Opt-out list (STOP handling), send logs, delivery status callbacks, template approval gating.
- **Multi-tenant** — Projects with scoped triggers, groups, and templates. Twilio is configured via environment variables only (read-only in Settings).

---

## Prerequisites

- Node.js 18+
- [Supabase](https://supabase.com) project (PostgreSQL, Auth)
- [Twilio](https://www.twilio.com) account with WhatsApp enabled

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create `.env.local` with:

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Messaging provider: twilio | gupshup | whatsapp_business (default: twilio)
MESSAGING_PROVIDER=twilio

# Twilio (when MESSAGING_PROVIDER=twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155552671

# Gupshup (when MESSAGING_PROVIDER=gupshup) — set GUPSHUP_APP_ID, GUPSHUP_APP_TOKEN, GUPSHUP_SENDER
# WhatsApp Business API (when MESSAGING_PROVIDER=whatsapp_business) — set WAB_ACCESS_TOKEN, WAB_PHONE_NUMBER_ID

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Inbound webhooks and the cron queue endpoint do **not** require secrets. See [ARCHITECTURE.md](ARCHITECTURE.md) for the full list.

**Production (hosted Supabase):** After linking and pushing migrations, set the cron URL once so pg_cron can call your deployed app:  
`UPDATE app_cron_config SET value = 'https://YOUR_APP_URL/api/cron/process-queue' WHERE key = 'process_queue_url';`  
Alternatively, leave it empty and use [Vercel Cron](https://vercel.com/docs/cron-jobs) only (same endpoint).

### 3. Database

```bash
# Start Supabase locally (if using local dev)
npx supabase start

# Run migrations (includes pg_cron + pg_net for queue)
npx supabase db push

# Seed demo data + local cron URL (templates, triggers, process_queue_url)
npm run db:reset
```

**Queue:** Migrations enable **pg_cron** and **pg_net** so the DB can call your app every minute. Seed sets `process_queue_url` for local (`http://host.docker.internal:3001/...`). If your app runs on another port, update `app_cron_config`: `UPDATE app_cron_config SET value = 'http://host.docker.internal:YOUR_PORT/api/cron/process-queue' WHERE key = 'process_queue_url';`

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Log in with the seeded user (see migrations for default credentials) or your Supabase Auth users.

---

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:reset` | Reset DB and run migrations + seed |
| `npx supabase start` | Start local Supabase |
| `npx supabase db push` | Apply migrations to linked project |

---

## Project structure (high level)

- `src/app/` — Next.js App Router (pages, API routes, cron).
- `src/components/` — UI (layout, triggers, templates, groups, send, queue, etc.).
- `src/lib/` — Engine (dispatcher, resolver), queue worker, channels (Twilio), Twilio Content API, Supabase clients.
- `supabase/migrations/` — Schema and seed data.

Details and message flow: [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Deploy

See **[docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md)** for step-by-step Vercel deployment (env vars, cron, and post-deploy config).

Short version:

1. **Vercel** — Connect repo, set env vars, deploy. Cron for `/api/cron/process-queue` is in `vercel.json` (runs every minute on Pro plan).
2. **Supabase** — Create project, run migrations. Optionally set `process_queue_url` to your app URL for pg_cron.
3. **Twilio** — Set status callback URL to `{NEXT_PUBLIC_APP_URL}/api/v1/webhooks/twilio`, or use **Settings → Twilio** → Sync from app URL.

---

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase](https://supabase.com/docs)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp)
