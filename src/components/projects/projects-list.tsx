"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

type Props = {
  projects: Project[];
  openCreate?: boolean;
};

export function ProjectsList({ projects, openCreate = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (openCreate || searchParams.get("open") === "create") setShowAdd(true);
  }, [openCreate, searchParams]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, slug: slug || name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, ""), description: description || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Failed to create");
      setShowAdd(false);
      setName("");
      setSlug("");
      setDescription("");
      const newSlug = data?.data?.slug;
      router.refresh();
      if (newSlug) {
        router.push(`/triggers?project=${encodeURIComponent(newSlug)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slug || slug === name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "")) {
      setSlug(v.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, ""));
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowAdd(true)}>Add Project</Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <h3 className="mb-4 text-sm font-medium">New Project</h3>
          <form onSubmit={handleAdd} className="space-y-3">
            {error && <p className="text-sm text-[var(--text-danger-default)]">{error}</p>}
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-base-secondary)]">Name</label>
              <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Qnav" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-base-secondary)]">Slug</label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="qnav" />
              <p className="mt-1 text-xs text-[var(--text-base-secondary)]">Lowercase, letters, numbers, underscores, hyphens</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-base-secondary)]">Description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create"}</Button>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length > 0 ? (
              projects.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/triggers?project=${encodeURIComponent(p.slug)}`)}
                >
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="font-mono text-sm text-[var(--text-base-secondary)]">{p.slug}</TableCell>
                  <TableCell className="max-w-xs truncate text-[var(--text-base-secondary)]">{p.description ?? "—"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-[var(--text-base-secondary)]">
                  No projects yet. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
