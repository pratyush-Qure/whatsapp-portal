# How Template Pending Status Gets Updated

Template approval state lives in **Supabase** (`templates.twilio_status`: `draft` | `pending` | `approved` | `rejected`). The **source of truth** for approval is **Meta/WhatsApp**, via **Twilio Content API**. This doc describes the flow and the two mechanisms that update pending → approved/rejected.

---

## 1. High-level flow (where status comes from)

```
┌─────────────────┐     Submit      ┌─────────────┐     Review      ┌──────────────┐
│  Portal (you)   │ ───────────────►│   Twilio    │ ──────────────►│ Meta/WhatsApp │
│  "Submit for    │                 │ Content API │                 │  (approval)   │
│   approval"     │                 │             │                 │               │
└────────┬────────┘                 └──────┬──────┘                 └───────┬───────┘
         │                                 │                                │
         │                                 │                                │
         ▼                                 │                                │
┌─────────────────┐                        │                                │
│  Supabase       │   We do NOT get        │     We POLL for status         │
│  templates      │   a webhook from       │     (no push from Meta/Twilio)  │
│  twilio_status  │   Meta/Twilio         │                                │
│  = "pending"    │◄───────────────────────┴────────────────────────────────┘
└─────────────────┘
```

- **Pending** is set when you submit for approval (portal → Twilio → Meta).
- **Approved/Rejected** is decided by Meta; we learn it only by **polling** Twilio’s Content API (no webhook).

---

## 2. When does status become "pending"?

```
┌──────────────┐     POST /api/v1/templates/[id]/submit      ┌──────────────────┐
│  Template    │ ──────────────────────────────────────────► │  Submit route    │
│  detail page │   (user clicks "Submit for approval")        │  (submit/route)  │
└──────────────┘                                             └────────┬─────────┘
                                                                      │
                     ┌────────────────────────────────────────────────┤
                     │                                                  │
                     ▼                                                  ▼
            ┌─────────────────┐                              ┌─────────────────────┐
            │ Twilio Content  │                              │ Supabase             │
            │ createContent   │                              │ templates UPDATE     │
            │ submitFor       │                              │ twilio_status =     │
            │ WhatsAppApproval│                              │   "pending"         │
            └─────────────────┘                              │ twilio_content_sid  │
                     │                                       │   = sid             │
                     └───────────────────────────────────────┘
```

- **Submit** creates the template in Twilio, submits it for WhatsApp approval, then writes **pending** + **twilio_content_sid** to Supabase. From then on, Meta reviews it; we don’t get a push, so we rely on the two update mechanisms below.

---

## 3. How "pending" gets updated to approved/rejected (auto + manual)

We only know the final status by **asking Twilio** (Content API: approval status). There are two automatic mechanisms and one manual:

- **Cron (backend):** Syncs up to 20 pending templates every time the cron runs (e.g. every minute).
- **In-page auto-sync:** On the template detail page, when status is **pending**, the UI polls the approval-status API every **90 seconds**. When Meta has approved or rejected, the page refreshes and shows the new status.
- **Manual:** User clicks **Sync approval status** to check immediately.

---

### Mechanism A: Cron job (background sync)

Called periodically (e.g. pg_cron every N minutes) so all pending templates get updated without user action.

```
┌─────────────────┐     GET /api/cron/process-queue       ┌─────────────────────────────┐
│  pg_cron /      │ ────────────────────────────────────►│  Cron route                │
│  external cron  │  (no auth; cron secret in production) │  process-queue/route.ts    │
└─────────────────┘                                      └─────────────┬───────────────┘
                                                                       │
                                                                       ▼
                                                              ┌─────────────────────────┐
                                                              │ syncPendingTemplates    │
                                                              │ ApprovalStatus(20)     │
                                                              │ (sync-approval-status) │
                                                              └─────────────┬───────────┘
                                                                           │
    ┌─────────────────────────────────────────────────────────────────────┤
    │                                                                       │
    ▼                                                                       ▼
┌─────────────────────────────┐                              ┌─────────────────────────────┐
│  Supabase                    │                              │  Twilio Content API        │
│  SELECT templates            │                              │  GET /Content/{sid}/       │
│  WHERE twilio_status='pending'│                              │       ApprovalRequests     │
│  LIMIT 20                    │                              │  → whatsapp.status         │
└──────────────┬────────────────┘                              └─────────────┬─────────────┘
               │                                                             │
               │  For each template:                                         │
               │  1. fetchApprovalStatus(contentSid) ◄────────────────────────┘
               │  2. Map status → approved | rejected | pending
               │  3. UPDATE templates SET twilio_status, twilio_rejected_reason
               ▼
┌─────────────────────────────┐
│  Supabase                    │
│  templates.twilio_status     │
│  = approved | rejected       │
│  (or stays pending)          │
└─────────────────────────────┘
```

- **Cron** runs `syncPendingTemplatesApprovalStatus(20)`: load up to 20 pending templates, call Twilio for each, then update Supabase. So **pending** is updated in the background on a schedule.

---

### Mechanism B: User clicks "Sync approval status" (on-demand)

When the user is on the template page, they can trigger a sync for that single template.

```
┌─────────────────────────────┐     GET /api/v1/templates/[id]/approval-status     ┌──────────────────────────┐
│  Template detail page      │ ──────────────────────────────────────────────────►│  approval-status route   │
│  "Sync approval status"    │     (user clicks button; auth required)            │                          │
└─────────────────────────────┘                                                   └────────────┬─────────────┘
                                                                                              │
                                                                                              ▼
                                                                                   ┌──────────────────────────┐
                                                                                   │ 1. Load template by id    │
                                                                                   │ 2. fetchApprovalStatus(   │
                                                                                   │      twilio_content_sid)  │
                                                                                   │ 3. UPDATE templates       │
                                                                                   │    SET twilio_status,     │
                                                                                   │    twilio_rejected_reason │
                                                                                   │ 4. Return new status      │
                                                                                   └────────────┬─────────────┘
                                                                                              │
                                                                                              ▼
                                                                                   ┌──────────────────────────┐
│  Page reload / UI update     │                                                   │  Twilio Content API      │
│  (e.g. "Template is         │◄──────────────────────────────────────────────────  same GET ApprovalRequests │
│   approved" or "Still       │                                                   └──────────────────────────┘
│   pending")                 │
└─────────────────────────────┘
```

- **Single-template sync**: same Twilio call and same Supabase update as the cron, but for one template and triggered by the user. After that, the UI shows the new status (often after a reload).

---

## 4. End-to-end sequence (one template)

```
  User                Portal API              Twilio                Meta              Cron / User
    │                     │                      │                   │                     │
    │  Submit for         │                      │                   │                     │
    │  approval           │                      │                   │                     │
    │────────────────────►│  Create + Submit      │                   │                     │
    │                     │─────────────────────►│  Submit            │                     │
    │                     │                      │──────────────────►│  (review queue)     │
    │                     │                      │                   │                     │
    │                     │  DB: pending, sid    │                   │                     │
    │                     │◄─────────────────────│                   │                     │
    │  "Submitted"        │                      │                   │                     │
    │◄────────────────────│                      │                   │                     │
    │                     │                      │                   │                     │
    │                     │                      │     (minutes/hours later)                │
    │                     │                      │                   │  approved/rejected │
    │                     │                      │◄──────────────────│                     │
    │                     │                      │                   │                     │
    │                     │     Cron OR "Sync"    │                   │                     │
    │                     │◄─────────────────────┼───────────────────┼─────────────────────│
    │                     │  GET ApprovalRequests│                   │                     │
    │                     │─────────────────────►│                   │                     │
    │                     │  status              │                   │                     │
    │                     │◄─────────────────────│                   │                     │
    │                     │  UPDATE templates    │                   │                     │
    │                     │  (approved/rejected) │                   │                     │
    │                     │                      │                   │                     │
    │  See new status     │                      │                   │                     │
    │  (reload or next     │                      │                   │                     │
    │   cron run)          │                      │                   │                     │
    │◄────────────────────│                      │                   │                     │
```

---

## 5. Summary table

| What updates status? | When | Scope | Code |
|----------------------|------|--------|------|
| **Submit** | User clicks "Submit for approval" | One template → set to **pending** | `POST .../templates/[id]/submit` |
| **Cron sync** | Scheduled (e.g. pg_cron) | Up to 20 **pending** templates per run | `syncPendingTemplatesApprovalStatus()` in `/api/cron/process-queue` |
| **In-page auto-sync** | Every 90 s while viewing a **pending** template | One template (current page) | `TemplateApprovalSection` useEffect → `GET .../approval-status` → `router.refresh()` |
| **Sync button** | User clicks "Sync approval status" on template page | One template | `GET .../templates/[id]/approval-status` |

- **Pending** is set only by **Submit**.
- **Approved/Rejected** are set only by **Cron sync** or **Sync button**, both of which call **Twilio Content API** `GET .../Content/{contentSid}/ApprovalRequests` and then update `templates.twilio_status` (and optionally `twilio_rejected_reason`) in Supabase.

---

## 6. Relevant files

- **Submit (set pending):** `src/app/api/v1/templates/[id]/submit/route.ts`
- **Twilio status fetch:** `src/lib/twilio/content.ts` (`fetchApprovalStatus`)
- **Cron sync (batch):** `src/lib/templates/sync-approval-status.ts`, `src/app/api/cron/process-queue/route.ts`
- **On-demand sync (one template):** `src/app/api/v1/templates/[id]/approval-status/route.ts`, `src/components/templates/template-approval-section.tsx` (Sync button)
