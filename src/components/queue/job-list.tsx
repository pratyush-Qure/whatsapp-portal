"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Job = {
  id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  failed_at: string | null;
  triggers: { slug: string; name: string } | { slug: string; name: string }[] | null;
  message_log_id?: string;
};

type Props = {
  jobs: Job[];
};

export function JobList({ jobs }: Props) {
  const router = useRouter();
  const [retrying, setRetrying] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRetry = async (jobId: string) => {
    setRetrying(jobId);
    try {
      const res = await fetch(`/api/v1/jobs/${jobId}/retry`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        router.refresh();
      } else {
        alert(data.error ?? data.message ?? "Retry failed");
      }
    } finally {
      setRetrying(null);
    }
  };

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <section className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Trigger</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Attempts</TableHead>
            <TableHead>Error</TableHead>
            <TableHead>Created</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.length > 0 ? (
            jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>
                  {(() => {
                    const t = Array.isArray(job.triggers) ? job.triggers[0] : job.triggers;
                    return (
                      <>
                        <span className="font-medium">{t?.name ?? "—"}</span>
                        <span className="ml-1 font-mono text-xs text-[var(--text-base-secondary)]">
                          {t?.slug ?? ""}
                        </span>
                      </>
                    );
                  })()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      job.status === "completed"
                        ? "success"
                        : job.status === "failed"
                          ? "danger"
                          : job.status === "pending"
                            ? "warning"
                            : "neutral"
                    }
                  >
                    {job.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {job.attempts}/{job.max_attempts}
                </TableCell>
                <TableCell className="max-w-xs truncate text-[var(--text-base-secondary)]">
                  {job.error_message ?? "—"}
                </TableCell>
                <TableCell className="text-[var(--text-base-secondary)]">
                  {new Date(job.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  {job.status === "failed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRetry(job.id)}
                      disabled={retrying === job.id}
                    >
                      {retrying === job.id ? "Retrying..." : "Retry"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-[var(--text-base-secondary)]">
                No jobs in queue.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>
    </section>
  );
}
