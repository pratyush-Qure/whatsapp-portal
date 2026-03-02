"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  providerConfigured: boolean;
};

export function TwilioStatusCallbackSync({ providerConfigured }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/settings/twilio/status-callback", {
        method: "PUT",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage(data.data?.message ?? "Synced.");
      } else {
        setError(data.error ?? data.message ?? "Sync failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSyncing(false);
    }
  };

  if (!providerConfigured) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Status Callback URL (Twilio)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-[var(--text-base-secondary)]">
          The app sends <strong>no</strong> Status Callback when <code className="rounded bg-[var(--bg-base-tertiary)] px-1">NEXT_PUBLIC_APP_URL</code> is
          localhost, so sends succeed and error 21609 is avoided. You can sync the Twilio phone number’s
          callback from this project: if the app URL is public (e.g. ngrok), it will be set; if localhost or
          empty, it will be cleared on Twilio.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? "Syncing…" : "Sync from app URL"}
          </Button>
        </div>
        {message && (
          <p className="text-sm text-[var(--text-success-default)]">{message}</p>
        )}
        {error && (
          <p className="text-sm text-[var(--text-danger-default)]">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
