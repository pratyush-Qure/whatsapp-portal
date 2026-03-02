"use client";

import { useProjectOptional } from "@/contexts/project-context";

export function ProjectSelector() {
  const ctx = useProjectOptional();
  if (!ctx || !ctx.project) return null;

  const projects = ctx.projects ?? [];
  if (projects.length === 0) return null;

  return (
    <select
      value={ctx.projectSlug ?? ""}
      onChange={(e) => ctx.setProject(e.target.value || null)}
      className="rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-3 py-1.5 text-sm text-[var(--text-base-default)]"
      aria-label="Select project"
    >
      {projects.map((p) => (
        <option key={p.id} value={p.slug}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
