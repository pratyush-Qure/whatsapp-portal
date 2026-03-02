import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JobList } from "@/components/queue/job-list";
import { getProjectIdBySlug } from "@/lib/project";

type Props = { searchParams: Promise<{ project?: string }> };

export default async function QueuePage({ searchParams }: Props) {
  const { project: projectSlug } = await searchParams;
  if (!projectSlug) redirect("/projects");
  const projectId = await getProjectIdBySlug(projectSlug);
  const supabase = await createClient();

  const { data: projectTriggers } = await supabase
    .from("triggers")
    .select("id")
    .eq("project_id", projectId);
  const triggerIds = (projectTriggers ?? []).map((t) => t.id);

  const [
    { count: pendingCount },
    { count: failedCount },
    { count: completedCount },
    { data: jobs },
  ] = await Promise.all([
    triggerIds.length
      ? supabase.from("job_queue").select("*", { count: "exact", head: true }).eq("status", "pending").in("trigger_id", triggerIds)
      : { count: 0 },
    triggerIds.length
      ? supabase.from("job_queue").select("*", { count: "exact", head: true }).eq("status", "failed").in("trigger_id", triggerIds)
      : { count: 0 },
    triggerIds.length
      ? supabase.from("job_queue").select("*", { count: "exact", head: true }).eq("status", "completed").in("trigger_id", triggerIds)
      : { count: 0 },
    triggerIds.length
      ? supabase
          .from("job_queue")
          .select(`
            id,
            trigger_id,
            message_log_id,
            status,
            attempts,
            max_attempts,
            error_message,
            created_at,
            completed_at,
            failed_at,
            triggers (slug, name)
          `)
          .in("trigger_id", triggerIds)
          .order("created_at", { ascending: false })
          .limit(50)
      : { data: [] },
  ]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
      <section>
        <h1 className="text-xl font-semibold text-[var(--text-base-default)]">Queue</h1>
        <p className="mt-1 text-sm text-[var(--text-base-secondary)]">
          Pending, completed, and failed jobs.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <p className="text-xs text-[var(--text-base-secondary)]">Pending</p>
          <p className="mt-1 text-2xl font-semibold">{pendingCount ?? 0}</p>
        </div>
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <p className="text-xs text-[var(--text-base-secondary)]">Completed</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-success-default)]">{completedCount ?? 0}</p>
        </div>
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <p className="text-xs text-[var(--text-base-secondary)]">Failed</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-danger-default)]">{failedCount ?? 0}</p>
        </div>
      </section>

      <JobList jobs={jobs ?? []} />
    </main>
  );
}
