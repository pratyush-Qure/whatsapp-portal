import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TriggerForm } from "@/components/triggers/trigger-form";
import { getProjectIdBySlug } from "@/lib/project";

type Props = { searchParams: Promise<{ project?: string }> };

export default async function NewTriggerPage({ searchParams }: Props) {
  const { project: projectSlug } = await searchParams;
  if (!projectSlug) redirect("/projects");
  const projectId = await getProjectIdBySlug(projectSlug);
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("templates")
    .select("id, name, project_id, projects (name)")
    .eq("twilio_status", "approved")
    .order("name");
  const templatesWithProject = (templates ?? []).map((t) => {
    const projectName = (t.projects as { name?: string } | null)?.name;
    return {
      id: t.id,
      name: projectName ? `${t.name} · ${projectName}` : t.name,
    };
  });

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 md:px-8">
      <section>
        <h1 className="text-xl font-semibold text-[var(--text-base-default)]">Create Trigger</h1>
        <p className="mt-1 text-sm text-[var(--text-base-secondary)]">
          Configure a new webhook trigger. Messaging account is configured via .env.
        </p>
      </section>
      <TriggerForm
        projectId={projectId}
        templates={templatesWithProject}
      />
    </main>
  );
}
