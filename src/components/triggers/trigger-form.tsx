"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { triggerFormSchema } from "@/lib/utils/validation";

type TriggerFormProps = {
  projectId?: string;
  trigger?: {
    id: string;
    slug: string;
    name: string;
    source_type: string;
    template_id: string;
    recipient_path: string;
    status: string;
    project_id?: string;
    config_json?: Record<string, unknown> | null;
  };
  templates?: { id: string; name: string }[];
};

export function TriggerForm({
  projectId,
  trigger,
  templates = [],
}: TriggerFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectSlug = searchParams.get("project");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState(trigger?.slug ?? "");
  const [name, setName] = useState(trigger?.name ?? "");
  const [templateId, setTemplateId] = useState(trigger?.template_id ?? "");
  const [recipientPath, setRecipientPath] = useState(trigger?.recipient_path ?? "phone");
  const [status, setStatus] = useState(trigger?.status ?? "active");
  const [httpMethod, setHttpMethod] = useState<string>(
    (trigger?.config_json && typeof trigger.config_json.http_method === "string")
      ? trigger.config_json.http_method
      : "POST"
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const parsed = triggerFormSchema.safeParse({
        project_id: projectId ?? trigger?.project_id,
        slug,
        name,
        template_id: templateId,
        recipient_path: recipientPath,
        status,
        http_method: httpMethod,
      });
      if (!parsed.success) {
        const issues: Record<string, string> = {};
        for (const i of parsed.error.issues) {
          const key = i.path[0]?.toString() ?? "form";
          if (!issues[key]) issues[key] = i.message;
        }
        setFieldErrors(issues);
        setError(parsed.error.issues.map((i) => i.message).join(". "));
        setLoading(false);
        return;
      }
      const url = trigger ? `/api/v1/triggers/${trigger.id}` : "/api/v1/triggers";
      const method = trigger ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          project_id: projectId ?? trigger?.project_id,
          slug,
          name,
          source_type: "webhook",
          template_id: templateId,
          recipient_path: recipientPath,
          status,
          config_json: {
            ...(trigger?.config_json as Record<string, unknown> | undefined),
            http_method: httpMethod,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Failed to save");
      const redirectPath = projectSlug
        ? `/triggers?project=${encodeURIComponent(projectSlug)}`
        : "/triggers";
      router.push(redirectPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{trigger ? "Edit Trigger" : "New Trigger"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-[var(--bg-danger-default)]/20 px-4 py-2 text-sm text-[var(--text-danger-default)]">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Slug <span className="text-[var(--text-danger-default)]">*</span>
            </label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              placeholder="order_confirmed"
              required
              disabled={!!trigger}
              aria-invalid={!!fieldErrors.slug}
            />
            {fieldErrors.slug && (
              <p className="mt-1 text-xs text-[var(--text-danger-default)]">{fieldErrors.slug}</p>
            )}
            <p className="mt-1 text-xs text-[var(--text-base-secondary)]">
              Lowercase letters, numbers, underscores only. Used in webhook URL.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Name <span className="text-[var(--text-danger-default)]">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Order Confirmation"
              required
              aria-invalid={!!fieldErrors.name}
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-[var(--text-danger-default)]">{fieldErrors.name}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Template <span className="text-[var(--text-danger-default)]">*</span>
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-3 py-2 text-sm"
              required
              aria-invalid={!!fieldErrors.template_id}
            >
              <option value="">Select template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {fieldErrors.template_id && (
              <p className="mt-1 text-xs text-[var(--text-danger-default)]">{fieldErrors.template_id}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Recipient Path (JSONPath)</label>
            <Input
              value={recipientPath}
              onChange={(e) => setRecipientPath(e.target.value)}
              placeholder="phone"
            />
            <p className="mt-1 text-xs text-[var(--text-base-secondary)]">
              Path to phone number in payload (e.g. phone, customer.phone)
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Webhook HTTP method</label>
            <select
              value={httpMethod}
              onChange={(e) => setHttpMethod(e.target.value)}
              className="w-full rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-3 py-2 text-sm"
            >
              <option value="GET">GET (open in browser, query params as payload)</option>
              <option value="POST">POST (JSON body, signature auth)</option>
            </select>
            <p className="mt-1 text-xs text-[var(--text-base-secondary)]">
              Default POST (recommended for JSON body and signature auth).
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              {trigger && <option value="paused">Paused</option>}
            </select>
            {!trigger && (
              <p className="mt-1 text-xs text-[var(--text-base-secondary)]">
                New triggers default to Active. Choose Draft only if you want to set up before activation.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : trigger ? "Update" : "Create"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
