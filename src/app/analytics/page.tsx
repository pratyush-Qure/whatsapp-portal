import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getProjectIdBySlug } from "@/lib/project";
import { AnalyticsSearchAndLogs } from "@/components/analytics/analytics-search-and-logs";

type Props = { searchParams: Promise<{ project?: string; q?: string }> };

export default async function AnalyticsPage({ searchParams }: Props) {
  const { project: projectSlug, q: triggerSearchQ } = await searchParams;
  if (!projectSlug) redirect("/projects");
  const projectId = await getProjectIdBySlug(projectSlug);
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let triggersQuery = supabase
    .from("triggers")
    .select("id, slug, name")
    .eq("status", "active")
    .eq("project_id", projectId)
    .order("name");
  if (triggerSearchQ?.trim()) {
    triggersQuery = triggersQuery.ilike("name", `%${triggerSearchQ.trim()}%`);
  }
  const [{ data: triggers }, { data: logs }] = await Promise.all([
    triggersQuery,
    supabase
      .from("message_logs")
      .select("trigger_id, status, error_code")
      .gte("created_at", since),
  ]);

  const triggerIds = new Set((triggers ?? []).map((t) => t.id));
  const logsForProject = (logs ?? []).filter((l) => triggerIds.has(l.trigger_id));

  const byTrigger = new Map<string, { sent: number; delivered: number; failed: number }>();
  const errors: Record<string, number> = {};

  for (const log of logsForProject) {
    const key = log.trigger_id;
    if (!byTrigger.has(key)) byTrigger.set(key, { sent: 0, delivered: 0, failed: 0 });
    const stats = byTrigger.get(key)!;
    if (["sent", "delivered", "read"].includes(log.status)) stats.sent++;
    if (["delivered", "read"].includes(log.status)) stats.delivered++;
    if (["failed", "undelivered"].includes(log.status)) {
      stats.failed++;
      const code = log.error_code ?? "unknown";
      errors[code] = (errors[code] ?? 0) + 1;
    }
  }

  const total = logsForProject.length;
  const delivered = logsForProject.filter((l) => ["delivered", "read"].includes(l.status)).length;
  const deliveryRate = total > 0 ? Math.round((delivered / total) * 1000) / 10 : 0;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
      <section>
        <h1 className="text-xl font-semibold text-[var(--text-base-default)]">Analytics</h1>
        <p className="mt-1 text-sm text-[var(--text-base-secondary)]">
          Last 30 days.
        </p>
        <Suspense fallback={null}>
          <AnalyticsSearchAndLogs projectSlug={projectSlug} />
        </Suspense>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <p className="text-xs text-[var(--text-base-secondary)]">Total Messages</p>
          <p className="mt-1 text-2xl font-semibold">{total}</p>
        </div>
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <p className="text-xs text-[var(--text-base-secondary)]">Delivered</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-success-default)]">{delivered}</p>
        </div>
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <p className="text-xs text-[var(--text-base-secondary)]">Delivery Rate</p>
          <p className="mt-1 text-2xl font-semibold">{deliveryRate}%</p>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-6">
        <h2 className="text-lg font-semibold">By Trigger</h2>
        <div className="mt-4 space-y-2">
          {triggers && triggers.length > 0 ? (
            triggers.map((t) => {
              const stats = byTrigger.get(t.id) ?? { sent: 0, delivered: 0, failed: 0 };
              const rate = stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 1000) / 10 : 0;
              return (
                <Link
                  key={t.id}
                  href={`/analytics/${t.id}?project=${encodeURIComponent(projectSlug)}`}
                  className="block rounded-md border border-[var(--border-base-default)] px-4 py-2 transition-colors hover:bg-[var(--bg-base-tertiary)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-sm text-[var(--text-base-secondary)]">
                      sent: {stats.sent} | delivered: {stats.delivered} | failed: {stats.failed} | {rate}%
                    </span>
                  </div>
                </Link>
              );
            })
          ) : (
            <p className="text-sm text-[var(--text-base-secondary)]">No triggers with messages yet.</p>
          )}
        </div>
      </section>

      {Object.keys(errors).length > 0 && (
        <section className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-6">
          <h2 className="text-lg font-semibold">Error Breakdown</h2>
          <div className="mt-4 space-y-2">
            {Object.entries(errors).map(([code, count]) => (
              <div
                key={code}
                className="flex items-center justify-between rounded-md border border-[var(--border-base-default)] px-4 py-2"
              >
                <span className="font-mono text-sm">{code}</span>
                <span className="text-sm text-[var(--text-base-secondary)]">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
