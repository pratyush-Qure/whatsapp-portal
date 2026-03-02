"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  triggerId: string;
  triggerSlug: string;
};

export function TestTriggerDialog({ triggerId, triggerSlug }: Props) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState('{\n  "phone": "+1234567890",\n  "name": "Test User"\n}');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const parsed = JSON.parse(payload) as Record<string, unknown>;
      const res = await fetch(`/api/v1/triggers/${triggerId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
      <h2 className="text-sm font-medium">Test Trigger</h2>
      <p className="mt-1 text-xs text-[var(--text-base-secondary)]">
        Dry run: resolve variables and preview message without sending.
      </p>
      <textarea
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
        className="mt-2 w-full rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-secondary)] p-2 font-mono text-sm"
        rows={4}
      />
      <Button
        className="mt-2"
        onClick={handleTest}
        disabled={loading}
      >
        {loading ? "Testing..." : "Test"}
      </Button>
      {result && (
        <pre className="mt-2 overflow-auto rounded-md bg-[var(--bg-base-tertiary)] p-2 text-xs">
          {result}
        </pre>
      )}
    </div>
  );
}
