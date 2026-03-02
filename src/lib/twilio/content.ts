/**
 * Twilio Content API: create WhatsApp templates, submit for approval, fetch status.
 * Uses content.twilio.com with credentials from environment (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN).
 * @see https://www.twilio.com/docs/content/content-api-resources
 */

const CONTENT_BASE = "https://content.twilio.com/v1";

/** Twilio Content SID format: HX followed by exactly 32 hex characters */
export function isValidContentSid(sid: string | null | undefined): boolean {
  return typeof sid === "string" && /^HX[a-fA-F0-9]{32}$/.test(sid);
}

export type ContentCreateParams = {
  friendly_name: string;
  language: string;
  body: string;
  footer?: string | null;
  category: "utility" | "marketing" | "authentication";
  /** Default/sample values for variables, e.g. { "1": "Customer_Name", "2": "Order_123" } */
  variables: Record<string, string>;
};

export type ApprovalStatus = "pending" | "approved" | "rejected" | "paused" | "disabled";

export type FetchApprovalResult = {
  status: ApprovalStatus;
  rejection_reason: string | null;
};

function mapTwilioApprovalStatus(twilioStatus: string): ApprovalStatus {
  const s = (twilioStatus || "").toLowerCase();
  if (s === "approved") return "approved";
  if (s === "rejected") return "rejected";
  if (s === "paused") return "paused";
  if (s === "disabled") return "disabled";
  return "pending"; // received, pending, etc.
}

function getTwilioCredentials(): { accountSid: string; authToken: string } {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("No Twilio account configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env");
  }
  return { accountSid, authToken };
}

async function contentFetch(
  path: string,
  method: "GET" | "POST" | "PUT",
  credentials: { accountSid: string; authToken: string },
  body?: object
): Promise<Record<string, unknown>> {
  const url = path.startsWith("http") ? path : `${CONTENT_BASE}${path}`;
  const auth = Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString("base64");
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = (data.message as string) || data.error_message || res.statusText;
    throw new Error(`Twilio Content API ${res.status}: ${message}`);
  }
  return data;
}

/**
 * Create a Content template (twilio/text) and return the Content SID.
 * Does not submit for WhatsApp approval; call submitForWhatsAppApproval after.
 */
export async function createContentTemplate(params: ContentCreateParams): Promise<{ sid: string }> {
  const credentials = getTwilioCredentials();

  const types: Record<string, unknown> = {
    "twilio/text": {
      body: params.body,
      ...(params.footer && params.footer.trim() && { footer: params.footer.trim() }),
    },
  };

  const friendly_name = params.friendly_name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 256) || "template";
  const body = {
    friendly_name,
    language: params.language.slice(0, 5),
    variables: params.variables,
    types,
  };

  const result = await contentFetch("/Content", "POST", credentials, body) as { sid?: string };
  if (!result.sid) throw new Error("Twilio did not return a Content SID");
  return { sid: result.sid };
}

/** WhatsApp category must be uppercase: UTILITY, MARKETING, AUTHENTICATION */
const CATEGORY_MAP: Record<string, string> = {
  utility: "UTILITY",
  marketing: "MARKETING",
  authentication: "AUTHENTICATION",
};

/**
 * Submit an existing Content template for WhatsApp approval.
 * Content must already be created (use createContentTemplate first).
 */
export async function submitForWhatsAppApproval(
  contentSid: string,
  params: { name: string; category: string }
): Promise<{ status: string }> {
  const credentials = getTwilioCredentials();
  const name = params.name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 256) || "template";
  const category = CATEGORY_MAP[params.category.toLowerCase()] ?? "UTILITY";
  const result = await contentFetch(
    `/Content/${contentSid}/ApprovalRequests/whatsapp`,
    "POST",
    credentials,
    { name, category }
  ) as { status?: string };
  return { status: result.status ?? "received" };
}

/**
 * Fetch WhatsApp approval status for a Content template.
 */
export async function fetchApprovalStatus(contentSid: string): Promise<FetchApprovalResult> {
  const credentials = getTwilioCredentials();
  const result = await contentFetch(
    `/Content/${contentSid}/ApprovalRequests`,
    "GET",
    credentials
  ) as { whatsapp?: { status?: string; rejection_reason?: string } };
  const whatsapp = result.whatsapp;
  if (!whatsapp) {
    return { status: "pending", rejection_reason: null };
  }
  const status = mapTwilioApprovalStatus(whatsapp.status ?? "");
  const rejection_reason =
    typeof whatsapp.rejection_reason === "string" && whatsapp.rejection_reason.trim()
      ? whatsapp.rejection_reason.trim()
      : null;
  return { status, rejection_reason };
}
