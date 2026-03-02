import { createClient } from "@/lib/supabase/server";
import { ProjectsList } from "@/components/projects/projects-list";

type Props = { searchParams: Promise<{ open?: string }> };

export default async function ProjectsPage({ searchParams }: Props) {
  const supabase = await createClient();
  const params = await searchParams;
  const openCreate = params?.open === "create";

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, slug, description")
    .order("name");

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
      <section>
        <h1 className="text-xl font-semibold text-[var(--text-base-default)]">Projects</h1>
        <p className="mt-1 text-sm text-[var(--text-base-secondary)]">
          Create and manage projects.
        </p>
      </section>

      <ProjectsList projects={projects ?? []} openCreate={openCreate} />
    </main>
  );
}
