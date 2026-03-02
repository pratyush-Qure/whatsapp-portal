import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getProjectIdBySlug } from "@/lib/project";

type Props = { searchParams: Promise<{ project?: string }> };

export default async function DashboardPage({ searchParams }: Props) {
  const { project: projectSlug } = await searchParams;
  const hasProject = Boolean(projectSlug);
  const projectId = await getProjectIdBySlug(projectSlug ?? null);
  const supabase = await createClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  if (!hasProject) {
    const { data: projects } = await supabase.from("projects").select("id, name, slug").order("name");
    return (
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
        <section className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-6">
          <h1 className="text-xl font-semibold text-[var(--text-base-default)]">Dashboard</h1>
          <p className="mt-2 text-sm text-[var(--text-base-secondary)]">
            Select a project.
          </p>
        </section>
        <section className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-6">
          <h2 className="text-lg font-semibold">Projects</h2>
          <p className="mt-1 text-sm text-[var(--text-base-secondary)]">
            Open a project to get started.
          </p>
          {projects && projects.length > 0 ? (
            <div className="mt-4 space-y-2">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/triggers?project=${encodeURIComponent(p.slug)}`}
                  className="block rounded-md border border-[var(--border-base-default)] px-4 py-2 transition-colors hover:bg-[var(--bg-base-tertiary)]"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 font-mono text-xs text-[var(--text-base-secondary)]">{p.slug}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--text-base-secondary)]">
              No projects yet. <Link href="/projects" className="text-[var(--text-brand-default)] hover:underline">Create one</Link> to get started.
            </p>
          )}
        </section>
      </main>
    );
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [
    { count: triggersCount },
    { count: templatesCount },
    { data: triggers },
    { data: logs },
    { data: logs24h },
  ] = await Promise.all([
    supabase.from("triggers").select("*", { count: "exact", head: true }).eq("status", "active").eq("project_id", projectId),
    supabase.from("templates").select("*", { count: "exact", head: true }).eq("project_id", projectId),
    supabase
      .from("triggers")
      .select("id, slug, name, status")
      .eq("status", "active")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("message_logs").select("status, trigger_id").gte("created_at", since),
    supabase
      .from("message_logs")
      .select("recipient_phone, trigger_id")
      .in("status", ["sent", "delivered", "read"])
      .gte("sent_at", since24h),
  ]);

  const triggerIds = new Set((triggers ?? []).map((t) => t.id));
  const logsForProject = (logs ?? []).filter((l) => triggerIds.has(l.trigger_id));
  const logs24hForProject = (logs24h ?? []).filter((l) => triggerIds.has(l.trigger_id));
  const uniqueRecipients24h = new Set(logs24hForProject.map((l) => (l as { recipient_phone: string }).recipient_phone)).size;

  const sent = logsForProject.filter((l) => ["sent", "delivered", "read"].includes(l.status)).length;
  const delivered = logsForProject.filter((l) => ["delivered", "read"].includes(l.status)).length;
  const failed = logsForProject.filter((l) => ["failed", "undelivered"].includes(l.status)).length;
  const queued = logsForProject.filter((l) => l.status === "queued").length;
  const total = logsForProject.length;
  const deliveryRate = total > 0 ? Math.round((delivered / total) * 1000) / 10 : 0;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
      <section className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-6">
        <h1 className="text-xl font-semibold text-[var(--text-base-default)]">Dashboard</h1>
        <p className="mt-2 max-w-4xl text-sm text-[var(--text-base-secondary)]">
          Trigger-driven WhatsApp messaging overview.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <p className="text-xs text-[var(--text-base-secondary)]">Active Triggers</p>
          <p className="mt-1 text-2xl font-semibold">{triggersCount ?? 0}</p>
        </div>
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <p className="text-xs text-[var(--text-base-secondary)]">Templates</p>
          <p className="mt-1 text-2xl font-semibold">{templatesCount ?? 0}</p>
        </div>
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <p className="text-xs text-[var(--text-base-secondary)]">Sent (7d)</p>
          <p className="mt-1 text-2xl font-semibold">{sent}</p>
        </div>
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <p className="text-xs text-[var(--text-base-secondary)]">Delivered</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-success-default)]">{delivered}</p>
        </div>
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <p className="text-xs text-[var(--text-base-secondary)]">Failed</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-danger-default)]">{failed}</p>
        </div>
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <p className="text-xs text-[var(--text-base-secondary)]">Delivery Rate</p>
          <p className="mt-1 text-2xl font-semibold">{deliveryRate}%</p>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
        <p className="text-xs text-[var(--text-base-secondary)]">Unique recipients (last 24h)</p>
        <p className="mt-1 text-2xl font-semibold">{uniqueRecipients24h}</p>
        <p className="mt-2 text-xs text-[var(--text-base-secondary)]">
          WhatsApp limits unique users per day (e.g. 1k/day for new numbers; scales with quality). Stay under your account limit.
        </p>
      </section>

      <section className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Active Triggers</h2>
          <Link
            href={projectSlug ? `/triggers/new?project=${encodeURIComponent(projectSlug)}` : "/triggers/new"}
            className="rounded-md bg-[var(--bg-brand-default)] px-4 py-2 text-sm font-medium text-[var(--text-brand-on-brand)] hover:opacity-90"
          >
            New Trigger
          </Link>
        </div>
        {triggers && triggers.length > 0 ? (
          <div className="space-y-2">
            {triggers.map((t) => (
              <Link
                key={t.id}
                href={`/triggers/${t.id}?project=${encodeURIComponent(projectSlug ?? "")}`}
                className="block rounded-md border border-[var(--border-base-default)] px-4 py-2 transition-colors hover:bg-[var(--bg-base-tertiary)]"
              >
                <span className="font-medium">{t.name}</span>
                <span className="ml-2 font-mono text-xs text-[var(--text-base-secondary)]">{t.slug}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-base-secondary)]">No active triggers. Create one to get started.</p>
        )}
      </section>
    </main>
  );
}
