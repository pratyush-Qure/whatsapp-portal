/**
 * Channel abstraction for plug-and-play messaging vendors (Twilio, Gupshup, WhatsApp Business API).
 * Triggers and the queue use these types; each vendor implements IChannelProvider.
 */

export type ChannelProviderType = "twilio" | "gupshup" | "whatsapp_business";

export type SendMessageParams = {
  to: string;
  from?: string;
  body: string;
  mediaUrl?: string[];
  contentSid?: string;
  contentVariables?: Record<string, string>;
  /** Twilio StatusCallback URL for delivery status webhooks (sent, delivered, read, failed) */
  statusCallback?: string;
};

export type SendMessageResult = {
  success: boolean;
  message_sid?: string | null;
  status?: string;
  error_code?: string | null;
  error_message?: string | null;
};

/**
 * Implement this interface for each messaging vendor.
 * Register in channels/index.ts so the worker and any send path use the same abstraction.
 */
export interface IChannelProvider {
  readonly type: ChannelProviderType;
  /** When accountId is null, use env-based config (e.g. TWILIO_*). */
  send(
    accountId: string | null,
    params: SendMessageParams
  ): Promise<SendMessageResult>;
}
