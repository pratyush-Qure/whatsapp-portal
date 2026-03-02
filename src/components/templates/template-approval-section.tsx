"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const AUTO_SYNC_INTERVAL_MS = 90_000; // 90 seconds while status is pending

type Props = {
  templateId: string;
  twilioStatus: string;
  twilioRejectedReason: string | null;
  templateName: string;
};

export function TemplateApprovalSection({
  templateId,
  twilioStatus,
  twilioRejectedReason,
  templateName,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const status = (twilioStatus ?? "draft").toLowerCase();

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/templates/${templateId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Submit failed");
        return;
      }
      setMessage(data.message ?? "Submitted for approval.");
      router.push("/templates");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/templates/${templateId}/approval-status`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Failed to fetch status");
        return;
      }
      setMessage(
        data.data?.twilio_status === "approved"
          ? "Template is approved. You can use it for sending."
          : data.data?.twilio_status === "rejected"
            ? "Template was rejected. See reason below."
            : "Status synced. Still pending review."
      );
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to check status");
    } finally {
      setChecking(false);
    }
  };

  // Auto-sync approval status while pending (poll every 90s); stop when approved/rejected or on unmount
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (status !== "pending") return;
    const sync = async () => {
      try {
        const res = await fetch(`/api/v1/templates/${templateId}/approval-status`, {
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) return;
        const newStatus = (data.data?.twilio_status ?? "").toLowerCase();
        if (newStatus === "approved" || newStatus === "rejected") {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setMessage(
            newStatus === "approved"
              ? "Template is approved. You can use it for sending."
              : "Template was rejected. See reason below."
          );
          router.refresh();
        }
      } catch {
        // ignore network errors; will retry next interval
      }
    };
    intervalRef.current = setInterval(sync, AUTO_SYNC_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status, templateId, router]);

  const badgeVariant =
    status === "approved"
      ? "success"
      : status === "rejected"
        ? "danger"
        : status === "pending"
          ? "warning"
          : "neutral";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Meta / WhatsApp approval</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--text-base-secondary)]">Status:</span>
          <Badge variant={badgeVariant}>{status}</Badge>
          {(status === "pending" || status === "approved") && (
            <span className="text-xs text-[var(--text-base-secondary)]">
              {status === "approved"
                ? "This template can be used for sending."
                : "Under review. Status is checked automatically every 90 seconds."}
            </span>
          )}
        </div>

        {status === "rejected" && twilioRejectedReason && (
          <div className="rounded-md border border-[var(--border-danger-default)] bg-[var(--bg-danger-default)]/10 px-4 py-3 text-sm text-[var(--text-danger-default)]">
            <p className="font-medium">Rejection reason (Meta)</p>
            <p className="mt-1">{twilioRejectedReason}</p>
            <p className="mt-2 text-xs opacity-90">
              Edit the template wording to address this, save it as draft, then submit for approval again.
            </p>
            <Link
              href="/templates/new"
              className="mt-3 inline-block text-sm font-medium text-[var(--text-brand-default)] hover:underline"
            >
              Create another template
            </Link>
          </div>
        )}

        {status === "rejected" && !twilioRejectedReason && (
          <p className="text-sm text-[var(--text-base-secondary)]">
            This template was rejected. Update the wording, save draft, and submit for approval again.
          </p>
        )}

        {error && (
          <div className="rounded-md bg-[var(--bg-danger-default)]/20 px-4 py-2 text-sm text-[var(--text-danger-default)]">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-md bg-[var(--bg-success-default)]/20 px-4 py-2 text-sm text-[var(--text-success-default)]">
            {message}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {status === "draft" && (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit for approval"}
            </Button>
          )}
          {(status === "pending" || status === "approved") && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCheckStatus}
              disabled={checking}
            >
              {checking ? "Checking…" : "Sync approval status"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
