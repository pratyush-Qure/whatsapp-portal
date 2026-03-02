/**
 * Channel layer: plug-and-play WhatsApp (and future) vendors.
 *
 * - Use sendMessage() for all outbound sends so we can switch vendors per trigger later.
 * - To add a vendor (e.g. Gupshup, WhatsApp Business API):
 *   1. Add provider type to ChannelProviderType in types.ts.
 *   2. Implement IChannelProvider in e.g. gupshup-provider.ts (credentials from DB or env).
 *   3. Register in PROVIDERS below.
 *   4. When ready, add channel_provider (and optionally channel_account_id) to triggers
 *      and pass provider from trigger into sendMessage.
 */

import type { ChannelProviderType, SendMessageParams, SendMessageResult } from "./types";
import { twilioProvider } from "./twilio-provider";

const PROVIDERS: Record<ChannelProviderType, { send: (accountId: string | null, params: SendMessageParams) => Promise<SendMessageResult> }> = {
  twilio: twilioProvider,
  gupshup: notImplemented("gupshup"),
  whatsapp_business: notImplemented("whatsapp_business"),
};

function notImplemented(name: string) {
  return {
    async send(_accountId: string | null): Promise<SendMessageResult> {
      return {
        success: false,
        error_message: `Provider "${name}" is not implemented. Add an adapter in src/lib/channels/ and register it here.`,
      };
    },
  };
}

/**
 * Send a message via the given provider.
 * Twilio uses a single account from env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER).
 * accountId is reserved for future multi-account support; currently ignored.
 */
export async function sendMessage(
  provider: ChannelProviderType,
  accountId: string | null,
  params: SendMessageParams
): Promise<SendMessageResult> {
  const impl = PROVIDERS[provider];
  if (!impl) {
    return { success: false, error_message: `Unknown provider: ${provider}` };
  }
  return impl.send(accountId, params);
}

export type { ChannelProviderType, SendMessageParams, SendMessageResult, IChannelProvider } from "./types";
