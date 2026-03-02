import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { TemplatesRefreshButton } from "@/components/templates/templates-refresh-button";
import { TemplatesTable } from "@/components/templates/templates-table";

type Props = { searchParams: Promise<{ project?: string }> };

export default async function TemplatesPage({ searchParams }: Props) {
  const { project: projectSlug } = await searchParams;
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("templates")
    .select(`
      id,
      name,
      category,
      language,
      body,
      twilio_status,
      twilio_content_sid,
      twilio_rejected_reason,
      created_at,
      project_id,
      projects (id, name, slug)
    `)
    .order("created_at", { ascending: false });

  const filteredTemplates =
    projectSlug && templates
      ? templates.filter((t) => (t.projects as { slug?: string } | null)?.slug === projectSlug)
      : templates ?? [];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
      <section className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-base-default)]">Templates</h1>
          <p className="mt-1 text-sm text-[var(--text-base-secondary)]">
            Message templates for triggers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TemplatesRefreshButton />
          <Link
            href="/templates/new"
            className="rounded-md bg-[var(--bg-brand-default)] px-4 py-2 text-sm font-medium text-[var(--text-brand-on-brand)] hover:opacity-90"
          >
            New Template
          </Link>
        </div>
      </section>

      <TemplatesTable
        templates={filteredTemplates.map((t) => {
          const project = t.projects as { name?: string } | null;
          return {
            id: t.id,
            name: t.name,
            category: t.category,
            language: t.language,
            body: t.body,
            twilio_status: t.twilio_status ?? "draft",
            twilio_rejected_reason: t.twilio_rejected_reason ?? null,
            created_at: t.created_at ?? null,
            project_name: project?.name ?? null,
          };
        })}
      />
    </main>
  );
}
