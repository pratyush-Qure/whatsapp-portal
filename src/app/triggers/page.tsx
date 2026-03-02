import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProjectIdBySlug } from "@/lib/project";
import { WebhookCopyButton } from "@/components/triggers/webhook-copy-button";
import { TriggerStatusBadge } from "@/components/triggers/trigger-status-badge";
import { InvokeTriggerButton } from "@/components/triggers/invoke-trigger-button";

type Props = { searchParams: Promise<{ project?: string }> };

export default async function TriggersPage({ searchParams }: Props) {
  const { project: projectSlug } = await searchParams;
  if (!projectSlug) redirect("/projects");
  const projectId = await getProjectIdBySlug(projectSlug);
  const supabase = await createClient();

  const [{ data: project }, { data: triggers }] = await Promise.all([
    supabase.from("projects").select("slug").eq("id", projectId).maybeSingle(),
    supabase
      .from("triggers")
      .select(`
        id,
        slug,
        name,
        source_type,
        status,
        recipient_path,
        config_json,
        created_at,
        templates (name)
      `)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resolvedProjectSlug = project?.slug ?? projectSlug ?? "default";

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-base-default)]">Triggers</h1>
          <p className="mt-1 text-sm text-[var(--text-base-secondary)]">
            Webhook and group-level triggers.
          </p>
        </div>
        <Link
          href={projectSlug ? `/triggers/new?project=${encodeURIComponent(projectSlug)}` : "/triggers/new"}
          className="rounded-md bg-[var(--bg-brand-default)] px-4 py-2 text-sm font-medium text-[var(--text-brand-on-brand)] hover:opacity-90"
        >
          New Trigger
        </Link>
      </section>


      <section className="overflow-x-auto rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Webhook</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {triggers && triggers.length > 0 ? (
              triggers.map((t) => {
                const webhookUrl = `${baseUrl}/api/v1/inbound/${resolvedProjectSlug}/${t.slug}`;
                const config = (t.config_json as Record<string, unknown>) ?? {};
                const method = (typeof config.http_method === "string" ? config.http_method : "POST").toUpperCase();
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link
                        href={`/triggers/${t.id}?project=${encodeURIComponent(resolvedProjectSlug)}`}
                        className="font-medium hover:underline"
                      >
                        {t.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{t.slug}</TableCell>
                    <TableCell>{(t.templates as { name?: string } | null)?.name ?? "—"}</TableCell>
                    <TableCell>
                      <TriggerStatusBadge
                        triggerId={t.id}
                        status={t.status}
                        projectSlug={resolvedProjectSlug}
                      />
                    </TableCell>
                    <TableCell>{t.source_type}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="flex items-center gap-2">
                        <code className="truncate font-mono text-xs text-[var(--text-base-secondary)]" title={webhookUrl}>
                          {method} {webhookUrl.replace(baseUrl, "")}
                        </code>
                        <WebhookCopyButton url={webhookUrl} />
                      </div>
                    </TableCell>
                    <TableCell className="text-[var(--text-base-secondary)]">
                      {new Date(t.created_at ?? "").toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <InvokeTriggerButton triggerId={t.id} recipientPath={t.recipient_path ?? "phone"} />
                        <Link
                          href={`/triggers/${t.id}?project=${encodeURIComponent(resolvedProjectSlug)}`}
                          className="text-sm text-[var(--text-brand-default)] hover:underline"
                        >
                          Edit
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-[var(--text-base-secondary)]">
                  No triggers yet. Create one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </main>
  );
}
