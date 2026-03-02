"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { templateFormSchema } from "@/lib/utils/validation";

type Variable = {
  id?: string;
  position: number;
  name: string;
  type: string;
  source: string;
  payload_path?: string | null;
  static_value?: string | null;
  required: boolean;
};

type TemplateFormProps = {
  projectId?: string;
  template?: {
    id: string;
    name: string;
    category: string;
    language: string;
    body: string;
    header_type?: string | null;
    header_content?: string | null;
    footer?: string | null;
    twilio_status?: string | null;
    variables?: Variable[];
  };
};

export function TemplateForm({ projectId, template }: TemplateFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitIntent, setSubmitIntent] = useState<"draft" | "approval">("draft");
  const [error, setError] = useState<string | null>(null);
  const [showUnlockWarning, setShowUnlockWarning] = useState(false);
  const [name, setName] = useState(template?.name ?? "");
  const [category, setCategory] = useState(template?.category ?? "utility");
  const [language, setLanguage] = useState(template?.language ?? "en");
  const [body, setBody] = useState(template?.body ?? "");
  const [footer, setFooter] = useState(template?.footer ?? "");

  const extractedVars = useMemo(() => extractVariables(body), [body]);
  const existingByPosition = useMemo(() => {
    const map = new Map<number, Variable>();
    for (const v of template?.variables ?? []) {
      map.set(v.position, v);
    }
    return map;
  }, [template?.variables]);

  const variables = useMemo(() => {
    return extractedVars.map((ev) => {
      const existing = existingByPosition.get(ev.position);
      if (!existing) return ev;
      return {
        ...ev,
        name: existing.name,
        type: existing.type,
        source: existing.source,
        payload_path: existing.payload_path ?? ev.payload_path,
        static_value: existing.static_value,
        required: existing.required,
      };
    });
  }, [extractedVars, existingByPosition]);

  const [variablePayloadPaths, setVariablePayloadPaths] = useState<Record<number, string>>({});
  const [variableTypes, setVariableTypes] = useState<Record<number, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const existingStatus = (template?.twilio_status ?? "draft").toLowerCase();
  const isInitiallyLocked = Boolean(template?.id) && (existingStatus === "approved" || existingStatus === "pending");
  const [isLocked, setIsLocked] = useState(isInitiallyLocked);
  const isEditable = !isLocked;

  useEffect(() => {
    setVariablePayloadPaths((prev) => {
      const next = { ...prev };
      for (const v of variables) {
        const key = v.payload_path ?? v.name ?? `var_${v.position}`;
        next[v.position] = prev[v.position] ?? key;
      }
      return next;
    });
    setVariableTypes((prev) => {
      const next = { ...prev };
      for (const v of variables) {
        next[v.position] = prev[v.position] ?? v.type ?? "text";
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, template?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditable) return;
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const parsed = templateFormSchema.safeParse({
        project_id: projectId ?? (template as { project_id?: string })?.project_id,
        name: name.trim(),
        category,
        language: language.trim() || "en",
        body: body.trim(),
        footer: footer.trim() || undefined,
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
      const variablesToSend = variables.map((v) => ({
        position: v.position,
        name: v.name,
        type: variableTypes[v.position] ?? v.type ?? "text",
        source: v.source,
        payload_path: variablePayloadPaths[v.position] ?? v.payload_path ?? v.name,
        static_value: v.static_value ?? undefined,
        required: v.required,
      }));
      const url = template ? `/api/v1/templates/${template.id}` : "/api/v1/templates";
      const method = template ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          project_id: projectId ?? (template as { project_id?: string })?.project_id,
          name,
          category,
          language,
          body,
          footer: footer || undefined,
          variables: variablesToSend,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?next=${encodeURIComponent("/templates/new")}`);
          setError("Session expired. Please log in again.");
          return;
        }
        throw new Error(data.error ?? data.message ?? "Failed to save");
      }

      const savedTemplateId = (data?.data?.id as string | undefined) ?? template?.id;
      if (submitIntent === "approval" && savedTemplateId) {
        const submitRes = await fetch(`/api/v1/templates/${savedTemplateId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        });
        const submitData = await submitRes.json().catch(() => ({}));
        if (!submitRes.ok) {
          // Avoid accidental duplicate create attempts from the new-template form.
          if (!template) {
            router.push(`/templates/${savedTemplateId}`);
            router.refresh();
            return;
          }
          throw new Error(submitData.message ?? submitData.error ?? "Failed to submit for approval");
        }
      }

      router.push("/templates");
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
        <CardTitle>{template ? "Edit Template" : "New Template"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEditable && (
            <div className="rounded-md border border-[var(--border-warning-default)] bg-[var(--bg-warning-default)]/10 px-4 py-3 text-sm text-[var(--text-warning-default)]">
              <p className="font-medium">This template is locked while status is {existingStatus}.</p>
              <p className="mt-1">
                Editing an approved or pending template will move it back to draft, and you will need to submit for approval again.
              </p>
              {!showUnlockWarning ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setShowUnlockWarning(true)}
                >
                  Enable editing
                </Button>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs">Are you sure? You will need to resubmit for approval.</span>
                  <Button
                    type="button"
                    onClick={() => {
                      setIsLocked(false);
                      setShowUnlockWarning(false);
                      setSubmitIntent("draft");
                    }}
                  >
                    Yes, unlock editing
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowUnlockWarning(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
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
              onChange={(e) => setName(e.target.value)}
              placeholder="order_confirm"
              required
              disabled={!isEditable || loading}
              aria-invalid={!!fieldErrors.name}
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-[var(--text-danger-default)]">{fieldErrors.name}</p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Category <span className="text-[var(--text-danger-default)]">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-3 py-2 text-sm"
                disabled={!isEditable || loading}
                aria-invalid={!!fieldErrors.category}
              >
                <option value="utility">Utility</option>
                <option value="marketing">Marketing</option>
                <option value="authentication">Authentication</option>
              </select>
              {fieldErrors.category && (
                <p className="mt-1 text-xs text-[var(--text-danger-default)]">{fieldErrors.category}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Language</label>
              <Input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="en"
                disabled={!isEditable || loading}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium">
                Body <span className="text-[var(--text-danger-default)]">*</span>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!isEditable || loading}
                onClick={() => {
                  const nextPos = extractedVars.length > 0
                    ? Math.max(...extractedVars.map((v) => v.position)) + 1
                    : 1;
                  setBody((prev) => prev + ` {{${nextPos}}}`);
                }}
              >
                + Add variable {"{{n}}"}
              </Button>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi {{1}}, your order {{2}} has been confirmed!"
              rows={5}
              required
              disabled={!isEditable || loading}
              aria-invalid={!!fieldErrors.body}
            />
            {fieldErrors.body && (
              <p className="mt-1 text-xs text-[var(--text-danger-default)]">{fieldErrors.body}</p>
            )}
            <p className="mt-1 text-xs text-[var(--text-base-secondary)]">
              Use {"{{1}}"}, {"{{2}}"}, etc. Variables are detected from the body. Click &quot;+ Add variable&quot; or type {"{{2}}"} manually.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Footer (optional)</label>
            <Input
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              placeholder="Reply STOP to unsubscribe"
              disabled={!isEditable || loading}
            />
          </div>

          {variables.length > 0 && (
            <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-secondary)] p-4">
              <h4 className="mb-2 text-sm font-medium">Variable mapping</h4>
              <p className="mb-3 text-xs text-[var(--text-base-secondary)]">
                Map placeholders to payload keys.
              </p>
              <div className="space-y-3">
                {variables.map((v) => (
                  <div key={v.position} className="flex flex-wrap items-center gap-2 gap-y-2">
                    <span className="w-12 shrink-0 font-mono text-sm text-[var(--text-base-secondary)]">
                      {"{{" + v.position + "}}"}
                    </span>
                    <Input
                      value={variablePayloadPaths[v.position] ?? v.payload_path ?? v.name}
                      onChange={(e) =>
                        setVariablePayloadPaths((prev) => ({
                          ...prev,
                          [v.position]: e.target.value.replace(/\s/g, "_").replace(/[^a-zA-Z0-9_.]/g, "").toLowerCase() || `var_${v.position}`,
                        }))
                      }
                      placeholder={`e.g. customer_name`}
                      className="max-w-[180px] font-mono text-sm"
                      disabled={!isEditable || loading}
                    />
                    <select
                      value={variableTypes[v.position] ?? v.type ?? "text"}
                      onChange={(e) =>
                        setVariableTypes((prev) => ({ ...prev, [v.position]: e.target.value }))
                      }
                      className="rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-2 py-1.5 text-sm"
                      title="Format: text, number, date, url, phone"
                      disabled={!isEditable || loading}
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="url">URL</option>
                      <option value="phone">Phone</option>
                    </select>
                    <span className="text-xs text-[var(--text-base-secondary)]">
                      → payload.{variablePayloadPaths[v.position] || v.payload_path || v.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {!template ? (
              <>
                <Button
                  type="submit"
                  variant="outline"
                  onClick={() => setSubmitIntent("draft")}
                  disabled={!isEditable || loading}
                >
                  {loading && submitIntent === "draft" ? "Saving..." : "Save as draft"}
                </Button>
                <Button
                  type="submit"
                  onClick={() => setSubmitIntent("approval")}
                  disabled={!isEditable || loading}
                >
                  {loading && submitIntent === "approval" ? "Submitting..." : "Create & submit for approval"}
                </Button>
              </>
            ) : (
              <Button type="submit" onClick={() => setSubmitIntent("draft")} disabled={!isEditable || loading}>
                {loading ? "Saving..." : "Update"}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function extractVariables(body: string): { position: number; name: string; type: string; source: string; payload_path: string; required: boolean; static_value?: string }[] {
  const matches = body.matchAll(/\{\{(\d+)\}\}/g);
  const seen = new Set<number>();
  const vars: { position: number; name: string; type: string; source: string; payload_path: string; required: boolean }[] = [];
  for (const m of matches) {
    const pos = parseInt(m[1], 10);
    if (seen.has(pos)) continue;
    seen.add(pos);
    vars.push({
      position: pos,
      name: `var_${pos}`,
      type: "text",
      source: "payload",
      payload_path: `var_${pos}`,
      required: true,
    });
  }
  return vars.sort((a, b) => a.position - b.position);
}
