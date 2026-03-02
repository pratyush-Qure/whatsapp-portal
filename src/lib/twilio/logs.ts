/**
 * Fetch message logs from Twilio's API (Message list).
 * Only works when MESSAGING_PROVIDER=twilio and credentials are set.
 */

import { getMessagingProvider } from "@/lib/messaging-provider";
import { getTwilioClient } from "@/lib/twilio";

export type TwilioLogEntry = {
  sid: string;
  to: string;
  from: string;
  dateSent: string | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  direction: string;
};

export type TwilioLogsResult =
  | { ok: true; messages: TwilioLogEntry[] }
  | { ok: false; error: string };

export async function getTwilioMessageLogs(options: {
  limit?: number;
  dateSentAfter?: Date;
}): Promise<TwilioLogsResult> {
  if (getMessagingProvider() !== "twilio") {
    return { ok: false, error: "Twilio is not the configured provider" };
  }

  try {
    const client = getTwilioClient();
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    const listOptions: { limit: number; dateSentAfter?: Date } = { limit };
    if (options.dateSentAfter) {
      listOptions.dateSentAfter = options.dateSentAfter;
    }

    const messages = await client.messages.list(listOptions);

    const entries: TwilioLogEntry[] = messages.map((m) => ({
      sid: m.sid,
      to: m.to ?? "",
      from: m.from ?? "",
      dateSent: m.dateSent ? m.dateSent.toISOString() : null,
      status: m.status ?? "unknown",
      errorCode: m.errorCode != null ? String(m.errorCode) : null,
      errorMessage: m.errorMessage ?? null,
      direction: m.direction ?? "outbound-api",
    }));

    return { ok: true, messages: entries };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch Twilio logs";
    return { ok: false, error: message };
  }
}
