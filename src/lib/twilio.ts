import Twilio from "twilio";

/**
 * Server-side Twilio client for WhatsApp messaging.
 * Use only in API routes, Server Actions, or server components.
 * Never expose credentials to the client.
 */
export function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error(
      "Missing Twilio credentials. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env"
    );
  }

  return Twilio(accountSid, authToken);
}

/**
 * Get the configured WhatsApp sender number.
 * Must be in format: whatsapp:+1234567890
 */
export function getWhatsAppSender(): string {
  const sender = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!sender) {
    throw new Error(
      "Missing TWILIO_WHATSAPP_NUMBER. Set it in .env (e.g. whatsapp:+14155238886)"
    );
  }
  return sender.startsWith("whatsapp:") ? sender : `whatsapp:${sender}`;
}

export type SendWhatsAppMessageParams = {
  to: string; // E.164 format, e.g. +919876543210
  body: string;
  mediaUrl?: string; // Optional image/document URL
};

/**
 * Send a WhatsApp message via Twilio (env-based credentials).
 * @returns Message SID on success
 */
export async function sendWhatsAppMessage({
  to,
  body,
  mediaUrl,
}: SendWhatsAppMessageParams): Promise<string> {
  const client = getTwilioClient();
  const from = getWhatsAppSender();
  const toWhatsApp = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  const message = await client.messages.create({
    body,
    from,
    to: toWhatsApp,
    ...(mediaUrl && { mediaUrl: [mediaUrl] }),
  });

  return message.sid;
}

export type SendWhatsAppMessageFromEnvResult = {
  success: boolean;
  message_sid?: string | null;
  status?: string;
  error_code?: string | null;
  error_message?: string | null;
};

/** Twilio cannot reach localhost; only use URLs that are publicly reachable. */
export function isPublicCallbackUrl(url: string | null | undefined): boolean {
  if (!url || !url.startsWith("http")) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
  } catch {
    return false;
  }
}

/** E.164 number from TWILIO_WHATSAPP_NUMBER (strip whatsapp: prefix). */
export function getWhatsAppNumberE164(): string {
  const s = process.env.TWILIO_WHATSAPP_NUMBER ?? "";
  return s.replace(/^whatsapp:/i, "").trim() || "";
}

export type StatusCallbackSyncResult =
  | { success: true; statusCallback: string | null; message: string }
  | { success: false; error: string; code?: string };

/**
 * Sync the Status Callback URL on the Twilio phone number (used for WhatsApp sender) to match the app.
 * - If NEXT_PUBLIC_APP_URL is public: set Twilio number's status_callback to {appUrl}/api/v1/webhooks/twilio.
 * - If localhost or unset: clear the number's status_callback so Twilio stops returning 21609.
 * The WhatsApp sender must be an IncomingPhoneNumber in your account (some sandbox setups may not be; then set in Console).
 */
export async function syncPhoneNumberStatusCallback(): Promise<StatusCallbackSyncResult> {
  try {
    const client = getTwilioClient();
    const numberE164 = getWhatsAppNumberE164();
    if (!numberE164) {
      return { success: false, error: "TWILIO_WHATSAPP_NUMBER is not set." };
    }

    const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: numberE164 });
    const incoming = numbers[0];
    if (!incoming) {
      return {
        success: false,
        error:
          "WhatsApp sender number not found as an Incoming Phone Number in your Twilio account. Set Status Callback URL manually in Twilio Console → Messaging → Senders.",
      };
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    const urlToSet = baseUrl && isPublicCallbackUrl(baseUrl)
      ? `${baseUrl}/api/v1/webhooks/twilio`
      : "";

    await client.incomingPhoneNumbers(incoming.sid).update({
      statusCallback: urlToSet,
    });

    return {
      success: true,
      statusCallback: urlToSet || null,
      message: urlToSet
        ? `Status Callback set to ${urlToSet}`
        : "Status Callback cleared (localhost or empty app URL). Use a public URL (e.g. ngrok) for delivery updates.",
    };
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    return {
      success: false,
      error: e?.message ?? "Twilio API error",
      code: e?.code != null ? String(e?.code) : undefined,
    };
  }
}

/**
 * Send via Twilio using only .env config. Used when no per-trigger account is set.
 */
export async function sendWhatsAppMessageFromEnv(params: {
  to: string;
  body: string;
  mediaUrl?: string[];
  contentSid?: string;
  contentVariables?: Record<string, string>;
  statusCallback?: string;
}): Promise<SendWhatsAppMessageFromEnvResult> {
  try {
    const client = getTwilioClient();
    const from = getWhatsAppSender();
    const toWhatsApp = params.to.startsWith("whatsapp:") ? params.to : `whatsapp:${params.to}`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const rawCallback = params.statusCallback ?? (baseUrl ? `${baseUrl.replace(/\/$/, "")}/api/v1/webhooks/twilio` : undefined);
    const statusCallback = isPublicCallbackUrl(rawCallback) ? rawCallback : undefined;
    const message = await client.messages.create({
      body: params.body,
      from,
      to: toWhatsApp,
      ...(params.mediaUrl?.length && { mediaUrl: params.mediaUrl }),
      ...(params.contentSid &&
        params.contentVariables && {
          contentSid: params.contentSid,
          contentVariables: JSON.stringify(params.contentVariables),
        }),
      ...(statusCallback && { statusCallback }),
    });
    return {
      success: true,
      message_sid: message.sid,
      status: message.status,
      error_code: message.errorCode != null ? String(message.errorCode) : null,
      error_message: message.errorMessage ?? null,
    };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    return {
      success: false,
      error_code: e?.code != null ? String(e.code) : null,
      error_message: e?.message ?? "Unknown Twilio error",
    };
  }
}
