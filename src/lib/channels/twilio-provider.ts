import type { IChannelProvider, SendMessageParams, SendMessageResult } from "./types";
import { sendWhatsAppMessageFromEnv, isPublicCallbackUrl } from "@/lib/twilio";

export const twilioProvider: IChannelProvider = {
  type: "twilio",
  async send(_accountId: string | null, params: SendMessageParams): Promise<SendMessageResult> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const raw = baseUrl ? `${baseUrl.replace(/\/$/, "")}/api/v1/webhooks/twilio` : params.statusCallback;
    const statusCallback = isPublicCallbackUrl(raw) ? raw : undefined;
    return sendWhatsAppMessageFromEnv({
      to: params.to,
      body: params.body,
      mediaUrl: params.mediaUrl,
      contentSid: params.contentSid,
      contentVariables: params.contentVariables,
      statusCallback,
    });
  },
};
