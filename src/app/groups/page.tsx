import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = { searchParams: Promise<{ project?: string }> };

export default async function GroupsPage({ searchParams }: Props) {
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
    .select("id, name, slug, description, default_trigger_id, created_at")
    .eq("project_id", projectId)
    .order("name");

  const resolvedSlug = project.slug;
  const groupIds = (groups ?? []).map((g) => g.id);
  const memberCounts = new Map<string, number>();
  const defaultTriggerNames = new Map<string, string>();
  if (groupIds.length > 0) {
    const [countsRes, triggersRes] = await Promise.all([
      supabase.from("group_members").select("group_id").in("group_id", groupIds),
      supabase.from("triggers").select("id, name").in("id", (groups ?? []).map((g) => g.default_trigger_id).filter((id): id is string => Boolean(id))),
    ]);
    for (const c of countsRes.data ?? []) {
      memberCounts.set(c.group_id, (memberCounts.get(c.group_id) ?? 0) + 1);
    }
    for (const t of triggersRes.data ?? []) {
      defaultTriggerNames.set(t.id, t.name);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 md:px-8">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-base-default)]">Groups</h1>
          <p className="mt-1 text-sm text-[var(--text-base-secondary)]">
            Recipient lists linked to triggers.
          </p>
        </div>
        <Link
          href={projectSlug ? `/groups/new?project=${encodeURIComponent(projectSlug)}` : "/groups/new"}
          className="rounded-md bg-[var(--bg-brand-default)] px-4 py-2 text-sm font-medium text-[var(--text-brand-on-brand)] hover:opacity-90"
        >
          New Group
        </Link>
      </section>

      <section className="overflow-x-auto rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Default trigger</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups && groups.length > 0 ? (
              groups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <Link
                      href={`/groups/${g.id}?project=${encodeURIComponent(resolvedSlug)}`}
                      className="font-medium hover:underline"
                    >
                      {g.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{g.slug}</TableCell>
                  <TableCell className="text-sm text-[var(--text-base-secondary)]">
                    {g.default_trigger_id ? defaultTriggerNames.get(g.default_trigger_id) ?? "—" : "—"}
                  </TableCell>
                  <TableCell>{memberCounts.get(g.id) ?? 0}</TableCell>
                  <TableCell className="text-[var(--text-base-secondary)]">
                    {new Date(g.created_at ?? "").toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/groups/${g.id}?project=${encodeURIComponent(resolvedSlug)}`}
                      className="text-sm text-[var(--text-brand-default)] hover:underline"
                    >
                      Edit
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-[var(--text-base-secondary)]">
                  No groups yet. Create one to reuse recipient lists and set a group-level trigger.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </main>
  );
}
