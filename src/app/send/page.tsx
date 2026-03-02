import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BulkSendTable } from "@/components/send/bulk-send-table";
import { getProjectIdBySlug } from "@/lib/project";

type Props = { searchParams: Promise<{ project?: string }> };

export default async function SendPage({ searchParams }: Props) {
  const { project: projectSlug } = await searchParams;
  if (!projectSlug) redirect("/projects");
  const projectId = await getProjectIdBySlug(projectSlug);
  const supabase = await createClient();

  const { data: triggers } = await supabase
    .from("triggers")
    .select(`
      id,
      slug,
      name,
      template_id,
      recipient_path,
      templates (
        id,
        name,
        body
      )
    `)
    .eq("project_id", projectId)
    .order("name");

  const triggerIds = (triggers ?? []).map((t) => t.template_id).filter(Boolean) as string[];
  const { data: variablesByTemplate } = triggerIds.length
    ? await supabase
        .from("template_variables")
        .select("template_id, position, name, payload_path, type")
        .in("template_id", triggerIds)
        .order("position")
    : { data: [] };

  const variablesMap = new Map<string, { position: number; name: string; payload_path: string | null; type: string }[]>();
  for (const v of variablesByTemplate ?? []) {
    const list = variablesMap.get(v.template_id) ?? [];
    list.push({
      position: v.position,
      name: v.name,
      payload_path: v.payload_path,
      type: v.type,
    });
    variablesMap.set(v.template_id, list.sort((a, b) => a.position - b.position));
  }

  const triggersWithVars = (triggers ?? []).map((t) => {
    const templates = Array.isArray(t.templates) ? t.templates[0] ?? null : t.templates;
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      template_id: t.template_id,
      recipient_path: t.recipient_path,
      templates,
      variables: variablesMap.get(t.template_id ?? "") ?? [],
    };
  });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
      <section>
        <h1 className="text-xl font-semibold text-[var(--text-base-default)]">Send Messages</h1>
        <p className="mt-1 text-sm text-[var(--text-base-secondary)]">
          Send by trigger to individuals or groups.
        </p>
      </section>

      <BulkSendTable triggers={triggersWithVars} projectId={projectId} />
    </main>
  );
}
