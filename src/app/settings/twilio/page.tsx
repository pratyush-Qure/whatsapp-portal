import { TwilioAccountsList } from "@/components/settings/twilio-accounts-list";
import { TwilioStatusCallbackSync } from "@/components/settings/twilio-status-callback-sync";
import { getProviderEnvInfo } from "@/lib/messaging-provider";

/**
 * Messaging provider is configured via MESSAGING_PROVIDER and provider-specific env vars.
 * This page shows a read-only view of the configured account.
 */
function getEnvDerivedAccounts(): { id: string | null; name: string; account_sid: string; phone_number: string; is_active: boolean; rate_limit_per_sec: number; created_at: string | null }[] {
  const info = getProviderEnvInfo();
  if (!info.configured) return [];
  return [
    {
      id: null,
      name: `Default (${info.displayName} from environment)`,
      account_sid: info.accountValue,
      phone_number: info.phoneValue,
      is_active: true,
      rate_limit_per_sec: 80,
      created_at: null,
    },
  ];
}

type Props = { searchParams: Promise<{ project?: string }> };

export default async function TwilioSettingsPage(_props: Props) {
  const accounts = getEnvDerivedAccounts();
  const info = getProviderEnvInfo();

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-8">
      <section>
        <h1 className="text-xl font-semibold text-[var(--text-base-default)]">Messaging Provider</h1>
        <p className="mt-1 text-sm text-[var(--text-base-secondary)]">
          Set MESSAGING_PROVIDER (twilio | gupshup | whatsapp_business) and the corresponding env vars. Current: <strong>{info.displayName}</strong>. Configure in .env — no auth or extra secrets required.
        </p>
      </section>

      <TwilioAccountsList accounts={accounts} providerName={info.displayName} envVarsHint={info.configured ? `${info.accountLabel}, ${info.phoneLabel}` : `Set ${info.accountLabel} and provider-specific vars in .env`} />

      {info.displayName.toLowerCase().includes("twilio") && (
        <TwilioStatusCallbackSync providerConfigured={info.configured} />
      )}
    </main>
  );
}
