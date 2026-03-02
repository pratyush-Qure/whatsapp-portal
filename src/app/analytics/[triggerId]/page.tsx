import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

type PageProps = { params: Promise<{ triggerId: string }> };

export default async function TriggerAnalyticsPage({ params }: PageProps) {
  const { triggerId } = await params;
  const supabase = await createClient();

  const { data: trigger, error } = await supabase
    .from("triggers")
    .select("id, slug, name, project_id")
    .eq("id", triggerId)
    .single();

  if (error || !trigger) notFound();

  const { data: project } = trigger.project_id
    ? await supabase.from("projects").select("slug").eq("id", trigger.project_id).single()
    : { data: null };
  const projectQuery = project?.slug ? `?project=${encodeURIComponent(project.slug)}` : "";

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: logs } = await supabase
    .from("message_logs")
    .select("status, error_code")
    .eq("trigger_id", triggerId)
    .gte("created_at", since);

  const funnel = { sent: 0, delivered: 0, read: 0, failed: 0, queued: 0 };
  const errors: Record<string, number> = {};

  for (const log of logs ?? []) {
    if (log.status === "sent") funnel.sent++;
    else if (log.status === "delivered") funnel.delivered++;
    else if (log.status === "read") funnel.read++;
    else if (log.status === "failed" || log.status === "undelivered") {
      funnel.failed++;
      const code = log.error_code ?? "unknown";
      errors[code] = (errors[code] ?? 0) + 1;
    } else funnel.queued++;
  }

  const total = funnel.sent + funnel.delivered + funnel.read + funnel.failed + funnel.queued;
  const rates = {
    delivery_rate: total > 0 ? Math.round((funnel.delivered / total) * 1000) / 10 : 0,
    read_rate: total > 0 ? Math.round((funnel.read / total) * 1000) / 10 : 0,
    failure_rate: total > 0 ? Math.round((funnel.failed / total) * 1000) / 10 : 0,
  };

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-8">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-base-default)]">{trigger.name}</h1>
          <p className="mt-1 font-mono text-sm text-[var(--text-base-secondary)]">{trigger.slug}</p>
        </div>
        <Link href={`/analytics${projectQuery}`} className="text-sm text-[var(--text-brand-default)] hover:underline">
          Back to Analytics
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <p className="text-xs text-[var(--text-base-secondary)]">Sent</p>
          <p className="mt-1 text-2xl font-semibold">{funnel.sent}</p>
        </div>
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <p className="text-xs text-[var(--text-base-secondary)]">Delivered</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-success-default)]">{funnel.delivered}</p>
        </div>
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <p className="text-xs text-[var(--text-base-secondary)]">Read</p>
          <p className="mt-1 text-2xl font-semibold">{funnel.read}</p>
        </div>
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <p className="text-xs text-[var(--text-base-secondary)]">Failed</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-danger-default)]">{funnel.failed}</p>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-6">
        <h2 className="text-lg font-semibold">Rates</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm text-[var(--text-base-secondary)]">Delivery Rate</p>
            <p className="mt-1 text-2xl font-semibold">{rates.delivery_rate}%</p>
          </div>
          <div>
            <p className="text-sm text-[var(--text-base-secondary)]">Read Rate</p>
            <p className="mt-1 text-2xl font-semibold">{rates.read_rate}%</p>
          </div>
          <div>
            <p className="text-sm text-[var(--text-base-secondary)]">Failure Rate</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-danger-default)]">{rates.failure_rate}%</p>
          </div>
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
