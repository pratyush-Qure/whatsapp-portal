"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createGroupSchema, updateGroupSchema } from "@/lib/utils/validation";

type TriggerOption = { id: string; name: string; slug: string };

type Props = {
  projectId: string;
  projectSlug: string;
  triggers: TriggerOption[];
  group?: { id: string; name: string; slug: string; description?: string | null; default_trigger_id?: string | null };
};

export function GroupForm({ projectId, projectSlug, triggers, group }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [name, setName] = useState(group?.name ?? "");
  const [slug, setSlug] = useState(group?.slug ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [defaultTriggerId, setDefaultTriggerId] = useState<string>(group?.default_trigger_id ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      if (group) {
        const parsed = updateGroupSchema.safeParse({
          name: name || undefined,
          slug: slug || undefined,
          description: description || undefined,
          default_trigger_id: defaultTriggerId || null,
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
      } else {
        const parsed = createGroupSchema.safeParse({
          project_id: projectId,
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || undefined,
          default_trigger_id: defaultTriggerId || null,
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
      }
      const url = group ? `/api/v1/groups/${group.id}` : "/api/v1/groups";
      const method = group ? "PUT" : "POST";
      const body = group
        ? { name: name.trim() || undefined, slug: slug.trim() || undefined, description: description.trim() || undefined, default_trigger_id: defaultTriggerId || null }
        : { project_id: projectId, name: name.trim(), slug: slug.trim() || undefined, description: description.trim() || undefined, default_trigger_id: defaultTriggerId || null };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.message ?? data.error ?? "Failed to save";
        const details = data.details ? (Array.isArray(data.details) ? data.details.map((d: { message?: string }) => d.message).filter(Boolean).join(". ") : String(data.details)) : "";
        throw new Error(details ? `${msg}: ${details}` : msg);
      }
      if (group) {
        router.push(`/groups/${group.id}?project=${encodeURIComponent(projectSlug)}`);
      } else if (data.data?.id) {
        router.push(`/groups/${data.data.id}?project=${encodeURIComponent(projectSlug)}`);
      } else {
        router.push(`/groups?project=${encodeURIComponent(projectSlug)}`);
      }
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
        <CardTitle>{group ? "Edit Group" : "New Group"}</CardTitle>
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
              Name <span className="text-[var(--text-danger-default)]">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!group) setSlug(e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, ""));
              }}
              placeholder="Care team"
              required
              aria-invalid={!!fieldErrors.name}
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-[var(--text-danger-default)]">{fieldErrors.name}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Slug {!group && <span className="text-[var(--text-danger-default)]">*</span>}
            </label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              placeholder="care_team"
              disabled={!!group}
              required={!group}
              aria-invalid={!!fieldErrors.slug}
            />
            {fieldErrors.slug && (
              <p className="mt-1 text-xs text-[var(--text-danger-default)]">{fieldErrors.slug}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Recipients for care notifications"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Group-level trigger (optional)</label>
            <select
              value={defaultTriggerId}
              onChange={(e) => setDefaultTriggerId(e.target.value)}
              className="w-full rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-3 py-2 text-sm"
            >
              <option value="">None – set later or use as standalone</option>
              {triggers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--text-base-secondary)]">
              When sending to this group, this trigger (and its template) will be used. You can also link more triggers from the trigger page.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : group ? "Update" : "Create"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/groups?project=${encodeURIComponent(projectSlug)}`)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
