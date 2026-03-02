import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProjectIdBySlug } from "@/lib/project";
import { GroupForm } from "@/components/groups/group-form";
import { GroupMembersSection } from "@/components/groups/group-members-section";
import { GroupTriggersSection } from "@/components/groups/group-triggers-section";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ project?: string }>;
};

export default async function GroupDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { project: projectSlug } = await searchParams;
  if (!projectSlug) notFound();
  const projectId = await getProjectIdBySlug(projectSlug);
  const supabase = await createClient();

  const { data: group, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", id)
    .eq("project_id", projectId)
    .single();

  if (error || !group) notFound();

  const { data: project } = await supabase.from("projects").select("slug").eq("id", projectId).maybeSingle();
  const resolvedSlug = project?.slug ?? projectSlug;

  const { data: triggers } = await supabase
    .from("triggers")
    .select("id, name, slug")
    .eq("project_id", projectId)
    .order("name");
  const triggerOptions = (triggers ?? []).map((t) => ({ id: t.id, name: t.name, slug: t.slug }));

  const { data: triggerLinks } = await supabase
    .from("trigger_groups")
    .select("trigger_id")
    .eq("group_id", id);
  const linkedTriggerIds = (triggerLinks ?? []).map((r) => r.trigger_id);
  let linkedTriggers: { id: string; name: string; slug: string }[] = [];
  if (linkedTriggerIds.length > 0) {
    const { data: t } = await supabase
      .from("triggers")
      .select("id, name, slug")
      .in("id", linkedTriggerIds);
    linkedTriggers = t ?? [];
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-8">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-base-default)]">{group.name}</h1>
          <p className="mt-1 font-mono text-sm text-[var(--text-base-secondary)]">{group.slug}</p>
        </div>
        <Link
          href={`/groups?project=${encodeURIComponent(resolvedSlug)}`}
          className="text-sm text-[var(--text-brand-default)] hover:underline"
        >
          Back to Groups
        </Link>
      </section>

      <GroupForm
        projectId={projectId}
        projectSlug={resolvedSlug}
        triggers={triggerOptions}
        group={{
          id: group.id,
          name: group.name,
          slug: group.slug,
          description: group.description,
          default_trigger_id: group.default_trigger_id ?? null,
        }}
      />

      <GroupMembersSection groupId={id} projectSlug={resolvedSlug} />

      <GroupTriggersSection
        groupId={id}
        groupName={group.name}
        linkedTriggers={linkedTriggers}
        projectSlug={resolvedSlug}
      />
    </main>
  );
}
