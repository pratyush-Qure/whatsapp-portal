import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GroupForm } from "@/components/groups/group-form";

type Props = { searchParams: Promise<{ project?: string }> };

export default async function NewGroupPage({ searchParams }: Props) {
  const { project: projectSlug } = await searchParams;
  if (!projectSlug) redirect("/projects");
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, slug")
    .eq("slug", projectSlug)
    .maybeSingle();
  if (!project) redirect("/projects");
  const projectId = project.id;
  const resolvedSlug = project.slug;

  const { data: triggers } = await supabase
    .from("triggers")
    .select("id, name, slug")
    .eq("project_id", projectId)
    .order("name");
  const triggerOptions = (triggers ?? []).map((t) => ({ id: t.id, name: t.name, slug: t.slug }));

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 md:px-8">
      <section className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-base-default)]">New Group</h1>
        <Link
          href={`/groups?project=${encodeURIComponent(resolvedSlug)}`}
          className="text-sm text-[var(--text-brand-default)] hover:underline"
        >
          Back to Groups
        </Link>
      </section>
      <GroupForm projectId={projectId} projectSlug={resolvedSlug} triggers={triggerOptions} />
    </main>
  );
}
