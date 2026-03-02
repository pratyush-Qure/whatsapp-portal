import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { TemplateForm } from "@/components/templates/template-form";
import { TemplateApprovalSection } from "@/components/templates/template-approval-section";
import { Badge } from "@/components/ui/badge";

type PageProps = { params: Promise<{ id: string }> };

export default async function TemplateEditPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: template, error } = await supabase
    .from("templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !template) notFound();

  const { data: variables } = await supabase
    .from("template_variables")
    .select("*")
    .eq("template_id", id)
    .order("position");

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-8">
      <section className="space-y-3">
        <Link
          href="/templates"
          className="inline-block text-sm text-[var(--text-brand-default)] hover:underline"
        >
          Back to Templates
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-base-default)]">{template.name}</h1>
            <p className="mt-1 text-sm text-[var(--text-base-secondary)]">
              v{template.version} · {template.category}
            </p>
          </div>
          <Badge
            variant={
              template.twilio_status === "approved"
                ? "success"
                : template.twilio_status === "pending"
                  ? "warning"
                  : template.twilio_status === "rejected"
                    ? "danger"
                    : "neutral"
            }
          >
            {template.twilio_status ?? "draft"}
          </Badge>
        </div>
      </section>

      <TemplateApprovalSection
        templateId={id}
        twilioStatus={template.twilio_status ?? "draft"}
        twilioRejectedReason={template.twilio_rejected_reason ?? null}
        templateName={template.name}
      />

      <TemplateForm
        template={{
          ...template,
          variables: variables ?? [],
        }}
      />
    </main>
  );
}
