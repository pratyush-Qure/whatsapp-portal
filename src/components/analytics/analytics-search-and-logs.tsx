"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { useDebounce } from "@/lib/hooks/use-debounce";

const DEBOUNCE_MS = 400;

type LogRow = {
  id: string;
  recipient_phone: string;
  status: string;
  twilio_message_sid: string | null;
  error_message: string | null;
  created_at: string;
  triggers: { slug?: string; name?: string } | { slug?: string; name?: string }[] | null;
};

type Props = { projectSlug: string };

export function AnalyticsSearchAndLogs({ projectSlug }: Props) {
  const [logSearch, setLogSearch] = useState("");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const debouncedLogSearch = useDebounce(logSearch, DEBOUNCE_MS);

  useEffect(() => {
    if (!debouncedLogSearch.trim()) {
      setLogs([]);
      return;
    }
    let cancelled = false;
    setLogsLoading(true);
    const params = new URLSearchParams({ project: projectSlug, q: debouncedLogSearch, limit: "50" });
    fetch(`/api/v1/logs?${params}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && body.success) setLogs(body.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setLogs([]);
      })
      .finally(() => {
        if (!cancelled) setLogsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectSlug, debouncedLogSearch]);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <SearchInput
          paramName="q"
          placeholder="Filter triggers"
          aria-label="Filter triggers"
          className="max-w-xs border-[var(--border-base-default)] bg-[var(--bg-base-default)] text-[var(--text-base-default)] placeholder:text-[var(--text-base-secondary)]"
        />
      </div>
      <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text-base-default)]">Logs</h3>
        <div className="mt-3">
          <Input
            type="search"
            value={logSearch}
            onChange={(e) => setLogSearch(e.target.value)}
            placeholder="Search"
            className="max-w-sm border-[var(--border-base-default)] bg-[var(--bg-base-default)] text-[var(--text-base-default)] placeholder:text-[var(--text-base-secondary)]"
            aria-label="Search logs"
          />
        </div>
        {(logSearch.trim() || logs.length > 0) && (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-4 text-center text-sm text-[var(--text-base-secondary)]">
                      —
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-4 text-center text-sm text-[var(--text-base-secondary)]">
                      —
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.slice(0, 20).map((log) => {
                    const trigger = Array.isArray(log.triggers) ? log.triggers[0] : log.triggers;
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {(trigger as { name?: string })?.name ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{log.recipient_phone}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              log.status === "delivered" || log.status === "read"
                                ? "success"
                                : log.status === "failed" || log.status === "undelivered"
                                  ? "danger"
                                  : "default"
                            }
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-[var(--text-base-secondary)]">
                          {log.error_message ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-[var(--text-base-secondary)]">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
