# Full local testing plan — WhatsApp Messaging Portal

This guide walks you through running the app locally and sending real WhatsApp messages to your own phone via templates.

---

## What you’ll need

| Requirement | Purpose |
|-------------|--------|
| **Node.js 18+** | Run Next.js |
| **Docker** | Local Supabase (PostgreSQL, Auth, pg_cron) |
| **Twilio account** | WhatsApp sending + template approval (Content API) |
| **Your phone number** | Recipient for test messages (E.164, e.g. `+919876543210`) |

---

## Phase 1: One-time setup

### 1.1 Clone, install, env

```bash
cd whatsapp-messaging-portal
npm install
```

Create **`.env.local`** in the project root:

```bash
# --- Supabase (required) ---
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# --- Messaging (Twilio) ---
MESSAGING_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155551234

# --- App URL (for webhooks + Twilio status callback) ---
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- **Supabase:** Use the values from [Supabase Dashboard](https://supabase.com/dashboard) → your project → Settings → API (URL, anon key, service_role key). For local Supabase, use the URL and keys printed by `npx supabase start`.
- **Twilio:** Account SID and Auth Token from [Twilio Console](https://console.twilio.com) → Dashboard → Account Info. WhatsApp number from Messaging → Senders → WhatsApp senders; use format `whatsapp:+<country><number>` (e.g. `whatsapp:+14155551234`).

### 1.2 Database (local Supabase)

```bash
# Start Supabase (requires Docker)
npx supabase start

# Apply migrations and seed (demo projects, templates, triggers, portal user, cron URL)
npm run db:reset
```

This creates:

- Projects: **Default**, **Qnav**
- Templates: e.g. `order_confirmation`, `appointment_reminder`, `welcome_message`, `otp_verification` (all start as **draft**)
- Triggers: e.g. **Order Confirmation**, **Appointment Reminder** (draft)
- Portal user: **pratyush.khandelwal@qure.ai** / **Qure@12345**
- Cron config: `process_queue_url` for queue processing (see Phase 2)

If you use **hosted Supabase** instead of local: link the project (`npx supabase link`), run `npx supabase db push`, then run the seed SQL or equivalent so the same data exists.

### 1.3 Run the app and queue worker

**Option A — Queue via pg_cron (DB calls your app every minute)**

Seed sets the cron URL to port **3001**. Run:

```bash
npm run dev:3001
```

Open **http://localhost:3001**. If you prefer port 3000, run `npm run dev` and update the DB:

```sql
UPDATE app_cron_config SET value = 'http://host.docker.internal:3000/api/cron/process-queue' WHERE key = 'process_queue_url';
```

**Option B — Queue via manual cron calls (no pg_cron)**

Run:

```bash
npm run dev
```

Open **http://localhost:3000**. When you want to process the queue (after invoking a trigger or sending from Send page), call:

```bash
curl "http://localhost:3000/api/cron/process-queue"
```

Do this after each test send so the job is processed and the message goes to Twilio.

**Option C — Dedicated queue worker (recommended for scalability)**

Run app + worker in separate terminals:

```bash
# Terminal 1
npm run dev:3001

# Terminal 2
QUEUE_WORKER_MODE=dedicated npm run worker:queue
```

How this works:

- Worker subscribes to `job_queue` changes (Supabase Realtime) and drains queue immediately.
- Worker also runs a small fallback poll every few seconds (for safety and scheduled jobs).
- Cron endpoint still handles inbound queue + recurring + template sync.
- With `QUEUE_WORKER_MODE=dedicated`, cron no longer drains `job_queue` directly (avoids double-processing loops).

Single-command alternative:

```bash
npm run dev:all
```

This will:

- ensure Supabase is started
- run app on the first **free port in 3002–3010** (avoids EADDRINUSE; check `[APP]` / `[dev-app-port]` log for the URL, e.g. http://localhost:3002)
- run the dedicated queue worker with `QUEUE_WORKER_MODE=dedicated`

### 1.4 ngrok — full local testing (webhooks + delivery status)

To make the **whole app locally testable** (Twilio webhooks, status callbacks, and delivery updates), expose your local server with [ngrok](https://ngrok.com) so Twilio can reach it.

**One-time (optional): install ngrok**

```bash
# macOS (Homebrew)
brew install ngrok

# Or download from https://ngrok.com/download
```

**Every local session:**

1. **Start the app** (and worker if you use Option C). Note the port (e.g. 3001, 3002).
2. **Start ngrok** on that port (use the port your app is actually on):

   ```bash
   ngrok http 3001
   ```

   You’ll see something like:

   ```
   Forwarding   https://abc123def.ngrok-free.app -> http://localhost:3001
   ```

3. **Copy the `https://` URL** (e.g. `https://abc123def.ngrok-free.app`). Use the **https** one.
4. **Set it in `.env.local`:**

   ```bash
   NEXT_PUBLIC_APP_URL=https://abc123def.ngrok-free.app
   ```

   Do **not** add a trailing slash.

5. **Restart the app** (and worker) so it picks up the new env. You still **open the app in the browser at http://localhost:3001** (or 3002); ngrok is only for Twilio → your app.
6. **(Optional) Twilio Status Callback** — In [Twilio Console](https://console.twilio.com) → Messaging → Senders → your WhatsApp sender → set **Status Callback URL** to:
   `https://YOUR_NGROK_URL/api/v1/webhooks/twilio`  
   Then delivery status (sent/delivered/read) will update in the portal.

**Notes:**

- Free ngrok URLs change each time you restart ngrok; update `NEXT_PUBLIC_APP_URL` and restart the app if the URL changes.
- Inbound webhooks (e.g. trigger invoke from external systems) should call your ngrok URL (e.g. `https://abc123.ngrok-free.app/api/v1/...`).
- Cron can keep calling `http://localhost:3001/api/cron/process-queue` (or your app port) from your machine; it doesn’t need to go through ngrok.

---

## Phase 2: Log in and pick a project

1. Go to **http://localhost:3000** (or 3001). If you ran `npm run dev:all`, use the URL shown in the terminal (e.g. http://localhost:3002 or 3003).
2. Click **Sign in** and log in with:
   - **Email:** `pratyush.khandelwal@qure.ai`
   - **Password:** `Qure@12345`
3. You’ll land on **Projects**. Select **Default** (or the project you want to use).
4. Use the project tabs: Dashboard, Triggers, Templates, Groups, **Send**, Queue, Analytics, Settings.

---

## Phase 3: Template approval (required before sending)

WhatsApp only allows sending with **approved** templates. The app uses Twilio’s Content API to submit templates to Meta for approval.

### 3.1 Choose a template

- Go to **Templates** and open one of the seeded templates (e.g. **order_confirmation**, **otp_verification**).
- Or create a new template: **Templates** → **New template** → set name, category, language, body (use `{{1}}`, `{{2}}`, etc. for variables), optional footer → save.

### 3.2 Submit for approval

1. On the template detail page, find the **Meta / WhatsApp approval** section.
2. Click **Submit for approval**.
3. The app creates the template in Twilio Content and submits it to Meta. You’ll see a success message and status will move to **pending**.
4. Wait for Meta to approve (can take from minutes to a few hours). Status is **auto-synced** every 90 seconds while you stay on the template page; you can also click **Sync approval status** to check immediately.
5. When status is **approved**, you can send messages with that template.

**If you get errors on submit:** Check that `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_WHATSAPP_NUMBER` are correct and that your Twilio WhatsApp sender is active. Template content must follow [WhatsApp template policies](https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-template-message).

### 3.3 Optional: Twilio status callback (delivery updates)

When **NEXT_PUBLIC_APP_URL** is `http://localhost:...`, the app **does not** send a StatusCallback URL to Twilio (Twilio cannot reach localhost), so messages still send successfully and you won’t see “StatusCallback URL is not valid”. Delivery status (sent/delivered/read) will not update in the app until you use a public URL.

To see **sent / delivered / read** in the portal and in **Queue** and **Analytics**:

1. Expose your local app (e.g. [ngrok](https://ngrok.com): `ngrok http 3000`).
2. Set **NEXT_PUBLIC_APP_URL** to the ngrok URL (e.g. `https://abc123.ngrok.io`) and restart the app.
3. In Twilio Console → your WhatsApp sender / number → set **Status Callback URL** to:  
   `https://YOUR_NGROK_URL/api/v1/webhooks/twilio`  
   Without this, messages still send but delivery status won’t update in the app.

---

## Phase 4: Send a message to your phone

Two main ways: **Invoke** (single number, simple payload) or **Send** (bulk table with all variables).

### 4.1 Ensure the trigger uses env Twilio

The app sends using **env** Twilio credentials (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`). The seeded triggers reference a placeholder Twilio account in the DB; the channel layer falls back to env when needed. Just ensure `.env.local` has the three Twilio variables set.

### 4.2 Option A — Invoke trigger (one number)

Best for templates with **no variables** or a **single variable** you can pass via API.

1. Go to **Triggers**, open a trigger (e.g. **Order Confirmation**).
2. Set trigger status to **Active** if you want (Invoke works for draft too).
3. Click **Invoke**.
4. Choose **One number**, enter **your phone** in E.164 (e.g. `+919876543210`).
5. Click **Invoke**.

**Important:** The Invoke UI only sends `phone`. If the template has **required variables** (e.g. `customer_name`, `order_id`, `total`), the API will return an error listing missing keys. Then either:

- Use **Option B (Send page)** and fill all columns, or
- Call the invoke API yourself with a full payload (see below).

**Invoke API example (curl) with variables:**

```bash
curl -X POST "http://localhost:3000/api/v1/triggers/TRIGGER_ID/invoke" \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{
    "target": "phone",
    "phone": "+919876543210",
    "customer_name": "Your Name",
    "order_id": "ORD-001",
    "total": "$25.00"
  }'
```

Replace `TRIGGER_ID` with the trigger UUID (from the trigger detail URL) and use the variable names that match the template’s **payload_path** (e.g. `customer_name`, `order_id`, `total` for order_confirmation).

### 4.3 Option B — Send page (recommended for templates with variables)

1. Go to **Send** (with the same project selected).
2. Select the **trigger** (e.g. Order Confirmation).
3. You’ll see a table with columns: **phone** and one column per template variable (e.g. customer_name, order_id, total).
4. Add a row with:
   - **phone:** your number (E.164)
   - Each variable filled (e.g. customer_name, order_id, total).
5. Click **Send** (or the equivalent primary action).

### 4.4 Process the queue

- If you’re on **port 3001** and pg_cron is running, the queue is processed every minute; wait a bit and check **Queue** and your phone.
- If you’re on **port 3000** without pg_cron, run:

  ```bash
  curl "http://localhost:3000/api/cron/process-queue"
  ```

  Then check **Queue** and your phone.

### 4.5 Check results

- **Queue:** List of jobs; status moves from pending → completed (or failed with error message).
- **Logs:** Message logs and Twilio-related entries (if logging is enabled).
- **Analytics:** Overview and per-trigger funnel (sent/delivered/read/failed) if status callback is configured.
- **Phone:** WhatsApp message from your Twilio number.

---

## Phase 5: End-to-end test checklist

Use this to confirm everything works:

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in with seed user | Redirect to dashboard / projects |
| 2 | Select project **Default** | Project tabs visible |
| 3 | **Templates** → open **otp_verification** | Template body with `{{1}}` |
| 4 | Submit for approval, wait / sync until **approved** | Status = approved |
| 5 | **Triggers** → open trigger that uses **otp_verification** (or create one) | Trigger detail with Invoke button |
| 6 | **Send** → Select trigger for **otp_verification** → add row: your phone + `otp_code` (e.g. `123456`) → Send | Response indicates queued; job appears in Queue |
| 7 | Process queue (wait for cron or `curl` `/api/cron/process-queue`) | Job completes in Queue |
| 8 | Check WhatsApp on your phone | Message received |

**Note:** For **otp_verification** the only variable is `otp_code`. The Invoke UI only sends `phone`, so the API will return missing variable `otp_code`. So either:

- Use the **Send** page and add a row: phone + `otp_code` (e.g. `123456`), or  
- Call the invoke API with body:  
  `{ "target": "phone", "phone": "+919876543210", "otp_code": "123456" }`.

For a true one-field Invoke from the UI, use a template that has **no** required payload variables (only static text).

---

## Troubleshooting

### I didn’t receive any message

Use this checklist so the whole flow works end-to-end:

1. **Template approved?**  
   In **Templates**, open the template used by your trigger. Status must be **approved**. If it’s draft or pending, submit for approval and wait (or use “Sync approval status”). Sends fail if the template isn’t approved.

2. **Phone number in E.164?**  
   Use country code + number, no spaces, e.g. `+919876543210`. The Send page and Invoke both expect E.164.

3. **Trigger has that template?**  
   In **Triggers**, open the trigger you’re using. The selected template must be the one that’s approved.

4. **Queue processed?**  
   Sends create a job in **Queue**. Something must process it:
   - **Dedicated worker:** If you ran `npm run dev:all` or `QUEUE_WORKER_MODE=dedicated npm run worker:queue`, the worker drains the queue (check terminal for “processed=1” or errors).
   - **No worker:** Call the cron endpoint so the app processes the queue:  
     `curl "http://localhost:3001/api/cron/process-queue"` (use your app port). Do this **after** you click Send.

5. **Job status in Queue?**  
   Open **Queue**. If the job is **pending**, it hasn’t been picked up yet (start the worker or call the cron URL). If **failed**, open the row and read **error_message** (e.g. template not approved, Twilio error, invalid number).

6. **Twilio env and WhatsApp sender**  
   In `.env.local`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` (e.g. `whatsapp:+14155551234`). In Twilio Console → Messaging → Senders, the WhatsApp sender must be **active** and the number must be correct.

7. **StatusCallback (optional)**  
   If you see “StatusCallback URL is not a valid URL”, the app now skips it when using localhost, so **sends still go through**. You just won’t get delivery updates in the app until you use ngrok (see **1.4 ngrok**).

---

### Queue shows “completed” but I didn’t receive the message on WhatsApp

**“Completed” means Twilio’s API accepted the message.** Delivery to the phone is handled by WhatsApp/Meta; the message can still fail or not show up after that. Use these steps:

1. **Check Twilio Logs (most useful)**  
   - Go to [Twilio Console](https://console.twilio.com) → **Monitor** → **Logs** → **Messaging** (or **Messages**).  
   - Find the message by **time** (same as the job’s “Created” or “Completed” time) and **To** (your number).  
   - Open it and check **Status**: e.g. `delivered`, `undelivered`, `failed`.  
   - If it’s `undelivered` or `failed`, Twilio will show the **Error code** and reason (e.g. number not on WhatsApp, invalid number, template issue).

2. **Verify your phone number**  
   - Correct **E.164** with country code (e.g. India `+91`, US `+1`), no spaces.  
   - The number must be **registered on WhatsApp** (same number on your phone with WhatsApp installed and logged in).

3. **Twilio Sandbox (if you’re on trial)**  
   - If your WhatsApp sender is the **Sandbox**, you must **join the sandbox** first: send the join code from your WhatsApp to the sandbox number (see Twilio Console → Messaging → Try it out → WhatsApp).  
   - Until you join, messages to your number may be accepted by Twilio but not delivered.

4. **First-time / 24-hour rule**  
   - For **template** messages you’re already allowed to send; no 24-hour window needed.  
   - If the recipient has **opted out** (e.g. sent “STOP”), WhatsApp may block delivery; check Twilio’s error in Logs.

5. **Same device / number**  
   - Confirm you’re checking WhatsApp on the **same number** you used in the Send page (no second SIM or different phone).

If Twilio Logs show **delivered** but you still don’t see it, check the correct WhatsApp account (and any linked devices) and that the app is updated.

---

### Twilio error 63032 — “User’s number is part of an experiment”

**What it means:** WhatsApp/Meta is blocking delivery to this number because it’s in a **small experiment** (~1% of users). For those users, template/marketing messages are restricted unless they messaged your business in the last 24 hours or started the conversation (e.g. via Click-to-WhatsApp).

**What you can do:**

- **For testing:** Use a **different phone number** (another SIM or a teammate’s number). Most numbers are not in the experiment, so switching usually unblocks testing.
- **For production:** You can’t “fix” the number; skip or handle 63032 (e.g. fallback to SMS or ask the user to message you first). You are not charged for undelivered messages.

Your queue shows **completed** because Twilio accepted the send; WhatsApp then rejected delivery for this recipient. See [Twilio 63032](https://www.twilio.com/docs/api/errors/63032) for more detail.

---

### Twilio error 63049 — “Meta chose not to deliver this WhatsApp marketing message”

**What it means:** Meta/WhatsApp can block or limit delivery for various reasons. Twilio labels this as "marketing message", but **63049 can also appear for utility templates** when Meta applies delivery limits (e.g. recipient engagement, volume, or regional rules). They cap how many marketing messages a user can receive from businesses in a period; once near the limit, Meta may choose not to deliver more (63049).

**What you can do:**

- **Use a different phone number:** The limit is per recipient; try another number (e.g. non-U.S. if yours is +1).
- **Use a different template:** Even for utility, try another template if you have one; sometimes one delivers and another doesn’t for the same recipient.
- **In production:** Respect the limit (don’t over-message); use utility/authentication where possible; [Twilio 63049](https://www.twilio.com/docs/api/errors/63049) has more detail.

You are not charged for undelivered messages.

---

### Adding another WhatsApp sender number (Twilio)

If you're on the **WhatsApp Sandbox**, you only have one sandbox number. To send from a **different** number you need to register a new WhatsApp sender (production).

**Option A — Register a new sender with a Twilio number**

1. In [Twilio Console](https://console.twilio.com) go to **Messaging** → **Senders** → **WhatsApp senders** (or [direct link](https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders)).
2. Click **Create new sender**.
3. Under **Select a phone number**, either:
   - **Use an existing Twilio number:** Pick one from the list (it must be able to receive SMS or voice for OTP).
   - **Buy a new number:** Go to **Phone Numbers** → **Manage** → **Buy a number**, buy a number in a region that supports WhatsApp, then return to WhatsApp Senders and select it.
4. Click **Continue** and complete **Self Sign-up**: link with **Facebook/Meta** (create or select a Meta Business Portfolio and WhatsApp Business Account), verify the number with the **OTP** Twilio shows (or send to the number), and confirm.
5. After registration, the new sender appears. Note the number (e.g. `+14155551234`).

**Option B — Register with your own (non‑Twilio) number**

1. Same as above: **Messaging** → **Senders** → **WhatsApp senders** → **Create new sender**.
2. Choose **Non-Twilio phone number** and enter a number that can receive **SMS** or **voice** for OTP and is **not** already on WhatsApp (or migrate it; see Twilio docs).
3. Complete Self Sign-up with Meta and enter the OTP you receive on that number.

**Use the new number in this app**

- In **.env.local** set:
  - `TWILIO_WHATSAPP_NUMBER=whatsapp:+1XXXXXXXXXX`  
  (replace with your new sender number, with country code, no spaces).
- Restart the app and queue worker.

**Notes**

- All WhatsApp senders in one Twilio account must use the **same** WhatsApp Business Account (WABA). When adding a second sender, select the **same WABA** as the first.
- Meta may require **business verification** for production; see [Twilio Self Sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up) and [Meta business verification](https://www.facebook.com/business/help/2058515294227817).

---

### Twilio “No results found” when buying a number (e.g. India)

**Why it happens**

- **No inventory:** In some countries (e.g. India) Twilio often has little or no numbers in the general pool. Supply depends on local carriers and regulations (e.g. TRAI in India).
- **Trial account:** You must **upgrade** your Twilio account (billing) to buy numbers. Trial accounts cannot purchase inbound numbers.
- **Search criteria:** Area code, city, or other filters may be too narrow; try country only or different options.

**What you can do**

1. **Upgrade account** — In Twilio Console: **Billing** → **Upgrade**. Then search again.
2. **Use a non-Twilio number for WhatsApp** — You don’t need a Twilio number to send WhatsApp. In **Messaging** → **Senders** → **WhatsApp senders** → **Create new sender**, choose **Non-Twilio phone number** and use an **Indian mobile number** you already have (or a new SIM) that can receive SMS for OTP and isn’t already on WhatsApp. Complete Self Sign-up with Meta; then set `TWILIO_WHATSAPP_NUMBER=whatsapp:+91XXXXXXXXXX` in `.env.local`.
3. **Try a number from another country** — If you only need a Twilio number for testing, buy one in a country where inventory exists (e.g. US: +1). You can use it as your WhatsApp sender (recipients can be in any country).
4. **Request an exclusive number** — In the buy-a-number flow, use **Request an exclusive number** (or **Private Offering**). Fill the form (account, country, quantity, use case). Twilio’s inventory team may be able to provision a number; review can take several days to a few weeks. For India, regulatory docs may be required.
5. **Contact Twilio** — [Twilio Support](https://support.twilio.com) or your account team; ask about India number availability or a custom order.

**Quick path for India WhatsApp**

Use **your own Indian mobile number** (or a dedicated SIM) as the WhatsApp sender: **WhatsApp senders** → **Create new sender** → **Non-Twilio phone number** → enter +91 number → complete Meta Self Sign-up (OTP via SMS). Then set that number in `TWILIO_WHATSAPP_NUMBER`.

---

### Why 21609 (Invalid StatusCallback) can still appear after you “cleared” it

Twilio can get the Status Callback URL from **two different places** for WhatsApp:

1. **Per-request (from our app)** — We only send a callback URL when `NEXT_PUBLIC_APP_URL` is **public** (not localhost). So if your env is localhost or empty, we don’t send it and this source is not the cause.
2. **WhatsApp Sender configuration in Twilio** — For **WhatsApp** messages, Twilio often uses the **sender’s** webhook/Status Callback URL, which is set in the **Messaging** product, not the phone number. So even if you cleared the **Incoming Phone Number** (or used “Sync from app URL”), the **WhatsApp sender** can still have a localhost URL.

**What to do:** Clear (or set) the Status Callback in the **WhatsApp** place in Twilio:

- Go to [Twilio Console](https://console.twilio.com) → **Messaging** → **Try it out** → **Send a WhatsApp message** (or **Senders** / **WhatsApp senders**).
- Open the **WhatsApp sender** you use (the number in `TWILIO_WHATSAPP_NUMBER`).
- Find **Status Callback URL** (or **Webhook** / **Status callback**).
- **Clear it** (leave blank) for local testing, or set it to a **public** URL (e.g. ngrok: `https://your-ngrok.ngrok-free.app/api/v1/webhooks/twilio`).
- Save.

Our **“Sync from app URL”** in Settings → Twilio updates the **Incoming Phone Number** via the API. For WhatsApp, Twilio may use the **WhatsApp sender** config instead, so you must clear/set it in the Messaging → WhatsApp sender UI as above.

---

| Issue | What to check |
|-------|----------------|
| “Template is not approved” | Submit template and wait for Meta approval; sync status on template page. |
| “Missing variable …” on Invoke | Pass all required variables in the request body (Send page or API). |
| Message queued but not received | Run cron or ensure worker is running; check Queue for failed job and error_message. See **I didn’t receive any message** above. |
| Queue shows completed but no message on WhatsApp | Twilio accepted the message; delivery is by WhatsApp. See **Queue shows “completed” but I didn’t receive the message** — check Twilio Logs, phone/WhatsApp, and sandbox join if on trial. |
| Job fails with Twilio error | Verify Account SID, Auth Token, and WhatsApp number in `.env.local`; confirm WhatsApp sender is active in Twilio. |
| **63032 – User’s number is part of an experiment** | WhatsApp blocks delivery for ~1% of numbers in an experiment. For testing, use a **different phone number**; see **Twilio error 63032** above. |
| **63049 – Meta chose not to deliver** | Can occur for marketing or utility. Try a **different phone number** (e.g. non‑U.S.) or another template; see **Twilio error 63049** above. |
| **Want another WhatsApp sender number** | Register a new sender in Twilio (Self Sign-up or buy a number); see **Adding another WhatsApp sender number** below. |
| “No Twilio account configured” | Set `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in `.env.local`. |
| Delivery status not updating | Set Twilio Status Callback URL to `NEXT_PUBLIC_APP_URL/api/v1/webhooks/twilio`; use ngrok for local. |
| pg_cron not calling app | App must be on port 3001 (or update `app_cron_config.process_queue_url`); Docker must be able to reach host (e.g. `host.docker.internal`). |
| `EADDRINUSE` on 3001/3002 | Port in use. Use `npm run dev:all` (picks first free port 3002–3010) or stop the process (e.g. `lsof -i :3002` then kill). |
| “Unable to acquire lock at .next/dev/lock” | Another `next dev` is running. Stop other Next dev terminals or remove `.next/dev/lock` and try again. |
| **21609** or “StatusCallback URL … not valid” | Two places in Twilio can set it; for WhatsApp, clear it on the **WhatsApp sender**. See **Why 21609 can still appear** above. |

---

## Summary: minimal path to one message on your phone

1. **Env:** Supabase + Twilio (Account SID, Auth Token, WhatsApp number) in `.env.local`.
2. **DB:** `npx supabase start` then `npm run db:reset`.
3. **Run:** `npm run dev:3001` (or `npm run dev:all` for app on a free port 3002–3010 + worker; or `npm run dev` + manual cron).
4. **(Optional) ngrok:** Run `ngrok http <your-app-port>`, set `NEXT_PUBLIC_APP_URL` to the https ngrok URL, restart app — so webhooks and delivery status work locally (see **1.4 ngrok**).
5. **Login:** pratyush.khandelwal@qure.ai / Qure@12345.
6. **Template:** Open a template → **Submit for approval** → wait until **approved**.
7. **Send:** Use **Send** page, pick trigger, add row with your phone (E.164) + all template variables, send.
8. **Queue:** Ensure the queue is processed (dedicated worker running, or call `GET /api/cron/process-queue` after sending).
9. **Check:** Queue page (job completed? or failed + error_message?) and WhatsApp on your phone.

If you don’t receive the message, follow **Troubleshooting → I didn’t receive any message**.
