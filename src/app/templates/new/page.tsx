import Link from "next/link";
import { TemplateForm } from "@/components/templates/template-form";
import { getProjectIdBySlug } from "@/lib/project";

type Props = { searchParams: Promise<{ project?: string }> };

export default async function NewTemplatePage({ searchParams }: Props) {
  const { project: projectSlug } = await searchParams;
  const projectId = await getProjectIdBySlug(projectSlug ?? null);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-8">
      <section className="space-y-3">
        <Link href="/templates" className="inline-block text-sm text-[var(--text-brand-default)] hover:underline">
          Back to Templates
        </Link>
        <h1 className="text-xl font-semibold text-[var(--text-base-default)]">Create Template</h1>
        <p className="mt-1 text-sm text-[var(--text-base-secondary)]">
          Create a WhatsApp message template with variables.
        </p>
      </section>
      <TemplateForm projectId={projectId} />
    </main>
  );
}
