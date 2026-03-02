import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { TriggerForm } from "@/components/triggers/trigger-form";
import { TestTriggerDialog } from "@/components/triggers/test-trigger-dialog";
import { WebhookCopyButton } from "@/components/triggers/webhook-copy-button";
import { TriggerGroupsSection } from "@/components/triggers/trigger-groups-section";

type PageProps = { params: Promise<{ id: string }> };

export default async function TriggerEditPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: trigger, error } = await supabase
    .from("triggers")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !trigger) notFound();

  const projectId = trigger.project_id;
  const [{ data: project }, { data: templates }, { data: currentTemplate }] = await Promise.all([
    supabase.from("projects").select("slug").eq("id", projectId).single(),
    supabase
      .from("templates")
      .select("id, name, project_id, projects (name)")
      .eq("twilio_status", "approved")
      .order("name"),
    trigger.template_id
      ? supabase.from("templates").select("id, name, project_id, projects (name)").eq("id", trigger.template_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const allTemplates = [...(templates ?? [])];
  if (currentTemplate && !allTemplates.some((t) => t.id === currentTemplate.id)) {
    allTemplates.push(currentTemplate);
  }

  const templatesWithProject = allTemplates.map((t) => {
    const projectName = (t.projects as { name?: string } | null)?.name;
    return {
      id: t.id,
      name: projectName ? `${t.name} · ${projectName}` : t.name,
    };
  });

  const projectSlug = project?.slug ?? "default";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const webhookUrl = `${baseUrl}/api/v1/inbound/${projectSlug}/${trigger.slug}`;
  const config = (trigger.config_json as Record<string, unknown>) ?? {};
  const httpMethod = (typeof config.http_method === "string" ? config.http_method : "POST").toUpperCase();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 md:px-8">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-base-default)]">{trigger.name}</h1>
          <p className="mt-1 font-mono text-sm text-[var(--text-base-secondary)]">{trigger.slug}</p>
        </div>
        <Link
          href={`/triggers?project=${encodeURIComponent(projectSlug)}`}
          className="text-sm text-[var(--text-brand-default)] hover:underline"
        >
          Back to Triggers
        </Link>
      </section>

      <section className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-[var(--text-base-default)]">Webhook URL</h2>
          <p className="mt-1 text-xs text-[var(--text-base-secondary)]">
            Call this URL when your platform has an update. Use {httpMethod} to invoke from a browser or external client.
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <code className="flex-1 min-w-0 break-all font-mono text-sm bg-[var(--bg-base-secondary)] px-2 py-1.5 rounded border border-[var(--border-base-default)]">
              {webhookUrl}
            </code>
            <WebhookCopyButton url={webhookUrl} />
          </div>
        </div>
        <div className="border-t border-[var(--border-base-default)] pt-3">
          <h3 className="text-xs font-medium text-[var(--text-base-secondary)] uppercase tracking-wide">How to call</h3>
          <ul className="mt-2 space-y-1 text-sm text-[var(--text-base-secondary)]">
            <li><strong>Method:</strong> {httpMethod}</li>
            {httpMethod === "GET" ? (
              <>
                <li><strong>Auth:</strong> No auth required.</li>
                <li><strong>Payload:</strong> Query params (e.g. <code className="font-mono text-xs">?phone=+15551234567&amp;name=Alice</code>). You can open the URL in a browser to invoke.</li>
              </>
            ) : (
              <>
                <li><strong>Content-Type:</strong> application/json</li>
                <li><strong>Auth:</strong> No auth required. POST JSON to the URL.</li>
                <li><strong>Body:</strong> JSON with <code className="font-mono text-xs">phone</code> (or path from trigger’s recipient path) and any keys your template variables use. Optional: <code className="font-mono text-xs">idempotency_key</code>.</li>
              </>
            )}
          </ul>
        </div>
      </section>

      <TestTriggerDialog triggerId={id} triggerSlug={trigger.slug} />

      <TriggerGroupsSection
        triggerId={id}
        projectSlug={projectSlug}
        projectId={projectId}
      />

      <TriggerForm
        projectId={projectId}
        trigger={trigger}
        templates={templatesWithProject}
      />
    </main>
  );
}
