import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UsersSearchTable } from "@/components/users/users-search-table";

type Props = { searchParams: Promise<{ project?: string }> };

export default async function UsersPage({ searchParams }: Props) {
  const { project: projectSlug } = await searchParams;
  if (!projectSlug) redirect("/projects");
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, slug, name")
    .eq("slug", projectSlug)
    .maybeSingle();
  if (!project) redirect("/projects");
  const projectId = project.id;

  const { data: groups } = await supabase
    .from("groups")
    .select("id, name")
    .eq("project_id", projectId);
  const groupIds = (groups ?? []).map((g) => g.id);

  if (groupIds.length === 0) {
    return (
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
        <section>
          <h1 className="text-xl font-semibold text-[var(--text-base-default)]">Users</h1>
          <p className="mt-1 text-sm text-[var(--text-base-secondary)]">
            Recipients in this project: phone, groups they belong to, and triggers/templates that can reach them.
          </p>
        </section>
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-8 text-center text-[var(--text-base-secondary)]">
          No groups in this project yet. Add groups and members to see users here.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
      <section>
        <h1 className="text-xl font-semibold text-[var(--text-base-default)]">Users</h1>
        <p className="mt-1 text-sm text-[var(--text-base-secondary)]">
          Recipients and their groups and triggers.
        </p>
      </section>
      <UsersSearchTable projectSlug={projectSlug} />
    </main>
  );
}
