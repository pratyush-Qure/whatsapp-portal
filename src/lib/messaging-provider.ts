/**
 * Messaging provider is selected via MESSAGING_PROVIDER (twilio | gupshup | whatsapp_business).
 * Env vars are read based on the provider; only one account per provider is supported (env only).
 */

import type { ChannelProviderType } from "@/lib/channels/types";

const PROVIDER_ENV = "MESSAGING_PROVIDER";
const DEFAULT_PROVIDER: ChannelProviderType = "twilio";

const VALID_PROVIDERS: ChannelProviderType[] = ["twilio", "gupshup", "whatsapp_business"];

export function getMessagingProvider(): ChannelProviderType {
  const raw = process.env[PROVIDER_ENV]?.trim().toLowerCase();
  if (raw && VALID_PROVIDERS.includes(raw as ChannelProviderType)) {
    return raw as ChannelProviderType;
  }
  return DEFAULT_PROVIDER;
}

/** Display name for Settings / UI */
export function getProviderDisplayName(provider: ChannelProviderType): string {
  switch (provider) {
    case "twilio":
      return "Twilio";
    case "gupshup":
      return "Gupshup";
    case "whatsapp_business":
      return "WhatsApp Business API";
    default:
      return String(provider);
  }
}

/** Env var names and masked values for the current provider (for read-only Settings display) */
export function getProviderEnvInfo(): {
  provider: ChannelProviderType;
  displayName: string;
  accountLabel: string;
  accountValue: string;
  phoneLabel: string;
  phoneValue: string;
  configured: boolean;
} {
  const provider = getMessagingProvider();
  const displayName = getProviderDisplayName(provider);

  switch (provider) {
    case "twilio": {
      const sid = process.env.TWILIO_ACCOUNT_SID ?? "";
      const phone = process.env.TWILIO_WHATSAPP_NUMBER ?? "";
      return {
        provider: "twilio",
        displayName,
        accountLabel: "TWILIO_ACCOUNT_SID",
        accountValue: sid ? `${sid.slice(0, 8)}...${sid.slice(-4)}` : "",
        phoneLabel: "TWILIO_WHATSAPP_NUMBER",
        phoneValue: phone.replace(/^whatsapp:/, ""),
        configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      };
    }
    case "gupshup": {
      const appId = process.env.GUPSHUP_APP_ID ?? "";
      const phone = process.env.GUPSHUP_SENDER ?? "";
      return {
        provider: "gupshup",
        displayName,
        accountLabel: "GUPSHUP_APP_ID",
        accountValue: appId ? `${appId.slice(0, 6)}...` : "",
        phoneLabel: "GUPSHUP_SENDER",
        phoneValue: phone,
        configured: !!(process.env.GUPSHUP_APP_ID && process.env.GUPSHUP_APP_TOKEN),
      };
    }
    case "whatsapp_business": {
      const phoneId = process.env.WAB_PHONE_NUMBER_ID ?? "";
      return {
        provider: "whatsapp_business",
        displayName,
        accountLabel: "WAB_PHONE_NUMBER_ID",
        accountValue: phoneId ? `${phoneId.slice(0, 8)}...` : "",
        phoneLabel: "WAB_PHONE_NUMBER_ID",
        phoneValue: phoneId,
        configured: !!(process.env.WAB_ACCESS_TOKEN && process.env.WAB_PHONE_NUMBER_ID),
      };
    }
    default:
      return {
        provider,
        displayName,
        accountLabel: "—",
        accountValue: "",
        phoneLabel: "—",
        phoneValue: "",
        configured: false,
      };
  }
}
