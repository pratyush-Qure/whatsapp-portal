# Deploy to Vercel

This guide walks you through deploying the WhatsApp Messaging Portal to [Vercel](https://vercel.com). The app is a Next.js project; the queue is processed by **Vercel Cron** (no separate worker process on Vercel).

---

## Prerequisites

- Code in a **Git** repo (GitHub, GitLab, or Bitbucket).
- A **Supabase** project (hosted) with migrations applied.
- **Twilio** account and WhatsApp sender configured.
- A **Vercel** account ([sign up](https://vercel.com/signup) if needed).

---

## 1. Push your code to Git

Ensure your project is in a Git repository and push to your remote (e.g. GitHub):

```bash
git add .
git commit -m "Prepare for Vercel deploy"
git push origin main
```

(Use your actual branch name if not `main`.)

---

## 2. Import the project in Vercel

1. Go to [vercel.com](https://vercel.com) and log in.
2. Click **Add New…** → **Project**.
3. **Import** the Git repository that contains this app (e.g. connect GitHub and select the repo).
4. Vercel will detect **Next.js** automatically. Leave **Framework Preset** as Next.js and **Root Directory** as `.` unless you use a monorepo.
5. Do **not** click Deploy yet — set environment variables first.

---

## 3. Set environment variables

In the project import screen (or later: **Project** → **Settings** → **Environment Variables**), add these for **Production** (and optionally Preview/Development):

| Name | Value | Notes |
|------|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | From Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon (public) key | Same place |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key | Same place (keep secret) |
| `MESSAGING_PROVIDER` | `twilio` | Or gupshup / whatsapp_business |
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID | Twilio Console → Dashboard |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token | Keep secret |
| `TWILIO_WHATSAPP_NUMBER` | `whatsapp:+1234567890` | Your WhatsApp sender number (E.164) |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | **Set after first deploy** (see step 6) |

- Do **not** commit `.env.local` or put secrets in the repo.
- You can add optional vars (e.g. `MESSAGING_PROJECT_ID`) if you use them.

---

## 4. Deploy

1. Click **Deploy**.
2. Wait for the build to finish. The first deployment will use a URL like `https://your-project-xxx.vercel.app`.
3. If the build fails, check the build logs (e.g. missing env var, TypeScript or lint errors).

---

## 5. Cron (queue processing)

The repo includes **vercel.json** with a cron that calls the queue endpoint every minute:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-queue",
      "schedule": "* * * * *"
    }
  ]
}
```

- **Vercel Pro** (or team/enterprise) is required for [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs). On the **Hobby** plan, cron is not available; you must use another way to trigger the queue (e.g. hosted Supabase with pg_cron calling your app, or an external cron service).
- If you use Vercel Cron, the queue is processed every minute; you do **not** run the dedicated worker (`worker:queue`) on Vercel.

---

## 6. Set the app URL and finish configuration

1. **NEXT_PUBLIC_APP_URL**  
   In Vercel: **Project** → **Settings** → **Environment Variables**, set:
   - `NEXT_PUBLIC_APP_URL` = `https://your-actual-domain.vercel.app`  
   (use your real Vercel URL, e.g. from the Deployments tab).
   - Redeploy so the new value is applied (e.g. **Deployments** → … → **Redeploy**).

2. **Supabase (optional)**  
   If you use **pg_cron** in hosted Supabase to hit your app (instead of or in addition to Vercel Cron), set the cron URL in the DB:
   ```sql
   UPDATE app_cron_config
   SET value = 'https://your-actual-domain.vercel.app/api/cron/process-queue'
   WHERE key = 'process_queue_url';
   ```

3. **Twilio Status Callback**  
   For delivery status updates (sent/delivered/read), set your WhatsApp sender’s Status Callback URL in Twilio to:
   `https://your-actual-domain.vercel.app/api/v1/webhooks/twilio`  
   Or use **Settings → Twilio** in the app and click **Sync from app URL** after `NEXT_PUBLIC_APP_URL` is set.

---

## 7. Custom domain (optional)

- In Vercel: **Project** → **Settings** → **Domains**, add your domain and follow the DNS instructions.
- After the domain is active, set `NEXT_PUBLIC_APP_URL` to that domain (e.g. `https://whatsapp.yourcompany.com`) and redeploy. Update Supabase `process_queue_url` and Twilio Status Callback URL if you use them.

---

## Summary

| Step | Action |
|------|--------|
| 1 | Push code to Git |
| 2 | Import repo in Vercel as a new project |
| 3 | Add env vars (Supabase, Twilio, `NEXT_PUBLIC_APP_URL` after first deploy) |
| 4 | Deploy |
| 5 | Rely on Vercel Cron for `/api/cron/process-queue` (Pro plan) or use pg_cron / external cron |
| 6 | Set `NEXT_PUBLIC_APP_URL`, update Supabase and Twilio if needed, redeploy |

**Note:** The dedicated queue worker (`npm run worker:queue`) is **not** run on Vercel. Queue processing is done by the **cron** calling `GET /api/cron/process-queue` (or by pg_cron / external cron hitting the same URL). The cron endpoint runs the same job-processing logic as the worker.
