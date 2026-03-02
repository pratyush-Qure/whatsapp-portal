import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getProjectIdBySlug } from "@/lib/project";
import { LogsSearchInput } from "@/components/logs/logs-search-input";
import { getTwilioMessageLogs } from "@/lib/twilio/logs";
import { getMessagingProvider } from "@/lib/messaging-provider";

type Props = { searchParams: Promise<{ project?: string; q?: string; source?: string }> };

function buildLogsUrl(projectSlug: string | null, q: string | undefined, source: string) {
  const params = new URLSearchParams();
  if (projectSlug) params.set("project", projectSlug);
  if (q?.trim()) params.set("q", q.trim());
  if (source && source !== "portal") params.set("source", source);
  const query = params.toString();
  return `/logs${query ? `?${query}` : ""}`;
}

export default async function LogsPage({ searchParams }: Props) {
  const { project: projectSlug, q: searchQ, source: sourceParam } = await searchParams;
  const source = sourceParam === "twilio" ? "twilio" : "portal";
  const projectId = await getProjectIdBySlug(projectSlug ?? null);
  const supabase = await createClient();
  const provider = getMessagingProvider();

  const { data: projectTriggers } = await supabase
    .from("triggers")
    .select("id")
    .eq("project_id", projectId);
  const triggerIds = (projectTriggers ?? []).map((t) => t.id);

  let query = supabase
    .from("message_logs")
    .select(`
      id,
      recipient_phone,
      status,
      twilio_message_sid,
      error_message,
      created_at,
      triggers (slug, name)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (triggerIds.length > 0) query = query.in("trigger_id", triggerIds);
  if (searchQ?.trim()) {
    const term = searchQ.trim();
    query = query.or(`recipient_phone.ilike.%${term}%,error_message.ilike.%${term}%`);
  }

  const { data: logs } = await query;

  const twilioResult = source === "twilio" ? await getTwilioMessageLogs({ limit: 100 }) : null;
  const twilioOk = twilioResult?.ok === true;
  const twilioMessages = twilioOk ? twilioResult.messages : [];
  const twilioError = twilioResult && !twilioResult.ok ? twilioResult.error : null;

  const baseUrl = buildLogsUrl(projectSlug ?? null, searchQ, "portal");
  const twilioUrl = buildLogsUrl(projectSlug ?? null, searchQ, "twilio");

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
      <section>
        <h1 className="text-xl font-semibold">Message Logs</h1>
        <p className="mt-2 text-sm text-[var(--text-base-secondary)]">
          {source === "portal"
            ? "Messages sent through triggers (portal)."
            : "Messages from Twilio API (all channels)."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <nav className="flex gap-1 rounded-md border border-[var(--border-base-default)] p-0.5">
            <Link
              href={baseUrl}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                source === "portal"
                  ? "bg-[var(--bg-brand-default)] text-[var(--text-brand-on-brand)]"
                  : "text-[var(--text-base-secondary)] hover:bg-[var(--bg-base-secondary)]"
              }`}
            >
              Portal
            </Link>
            <Link
              href={twilioUrl}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                source === "twilio"
                  ? "bg-[var(--bg-brand-default)] text-[var(--text-brand-on-brand)]"
                  : "text-[var(--text-base-secondary)] hover:bg-[var(--bg-base-secondary)]"
              }`}
            >
              Twilio
            </Link>
          </nav>
          {source === "portal" && (
            <Suspense fallback={null}>
              <LogsSearchInput />
            </Suspense>
          )}
        </div>
      </section>

      {source === "portal" && (
        <section className="overflow-x-auto rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trigger</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Twilio SID</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs && logs.length > 0 ? (
                logs.map((log) => {
                  const trigger = Array.isArray(log.triggers) ? log.triggers[0] : log.triggers;
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <span className="font-medium">{(trigger as { name?: string })?.name ?? "—"}</span>
                        <span className="ml-1 font-mono text-xs text-[var(--text-base-secondary)]">
                          {(trigger as { slug?: string })?.slug}
                        </span>
                      </TableCell>
                      <TableCell>{log.recipient_phone}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.status === "delivered" || log.status === "read"
                              ? "success"
                              : log.status === "failed" || log.status === "undelivered"
                                ? "danger"
                                : log.status === "sent"
                                  ? "default"
                                  : "neutral"
                          }
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[var(--text-base-secondary)]">
                        {log.twilio_message_sid ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-[var(--text-base-secondary)]">
                        {log.error_message ?? "—"}
                      </TableCell>
                      <TableCell className="text-[var(--text-base-secondary)]">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-[var(--text-base-secondary)]">
                    No message logs yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
      )}

      {source === "twilio" && (
        <section className="overflow-x-auto rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)]">
          {provider !== "twilio" && (
            <div className="p-4 text-center text-sm text-[var(--text-base-secondary)]">
              Twilio logs are only available when Twilio is the configured provider (MESSAGING_PROVIDER=twilio).
            </div>
          )}
          {provider === "twilio" && twilioError && (
            <div className="p-4 text-center text-sm text-[var(--text-danger-default)]">
              {twilioError}
            </div>
          )}
          {provider === "twilio" && twilioOk && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>To</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>SID</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Date sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {twilioMessages.length > 0 ? (
                  twilioMessages.map((m) => (
                    <TableRow key={m.sid}>
                      <TableCell className="font-mono text-sm">{m.to}</TableCell>
                      <TableCell className="font-mono text-sm">{m.from}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            m.status === "delivered" || m.status === "read"
                              ? "success"
                              : m.status === "failed" || m.status === "undelivered"
                                ? "danger"
                                : m.status === "sent"
                                  ? "default"
                                  : "neutral"
                          }
                        >
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[var(--text-base-secondary)]">{m.direction}</TableCell>
                      <TableCell className="font-mono text-xs text-[var(--text-base-secondary)]">{m.sid}</TableCell>
                      <TableCell className="max-w-xs truncate text-[var(--text-base-secondary)]">
                        {m.errorCode && m.errorMessage ? `${m.errorCode}: ${m.errorMessage}` : m.errorMessage ?? "—"}
                      </TableCell>
                      <TableCell className="text-[var(--text-base-secondary)]">
                        {m.dateSent ? new Date(m.dateSent).toLocaleString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-[var(--text-base-secondary)]">
                      No Twilio messages returned.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </section>
      )}
    </main>
  );
}
