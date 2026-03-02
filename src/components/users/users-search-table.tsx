"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/hooks/use-debounce";
import type { ProjectUserRow } from "@/app/api/v1/users/route";

const DEBOUNCE_MS = 400;

type Props = {
  projectSlug: string;
};

export function UsersSearchTable({ projectSlug }: Props) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<ProjectUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const debouncedQ = useDebounce(q, DEBOUNCE_MS);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ project: projectSlug });
    if (debouncedQ) params.set("q", debouncedQ);
    fetch(`/api/v1/users?${params}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && body.success) setUsers(body.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectSlug, debouncedQ]);

  const projectQuery = `?project=${encodeURIComponent(projectSlug)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          type="search"
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm border-[var(--border-base-default)] bg-[var(--bg-base-default)] text-[var(--text-base-default)] placeholder:text-[var(--text-base-secondary)]"
          aria-label="Search users"
        />
      </div>

      <section className="overflow-x-auto rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Groups</TableHead>
              <TableHead>Triggers</TableHead>
              <TableHead>Templates</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-[var(--text-base-secondary)]">
                  —
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-[var(--text-base-secondary)]">
                  No users found. Add members to groups in this project to see them here.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.phone}>
                  <TableCell className="font-mono text-sm">{u.phone}</TableCell>
                  <TableCell className="text-sm">{u.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    <span className="flex flex-wrap gap-1">
                      {u.groups.length === 0
                        ? "—"
                        : u.groups.map((g) => (
                            <Link
                              key={g.id}
                              href={`/groups/${g.id}${projectQuery}`}
                              className="rounded bg-[var(--bg-base-tertiary)] px-2 py-0.5 text-xs text-[var(--text-brand-default)] hover:underline"
                            >
                              {g.name}
                            </Link>
                          ))}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="flex flex-wrap gap-1">
                      {u.triggers.length === 0
                        ? "—"
                        : u.triggers.map((t) => (
                            <Link
                              key={t.id}
                              href={`/triggers/${t.id}${projectQuery}`}
                              className="rounded bg-[var(--bg-base-tertiary)] px-2 py-0.5 text-xs text-[var(--text-brand-default)] hover:underline"
                            >
                              {t.name}
                            </Link>
                          ))}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-[var(--text-base-secondary)]">
                    {u.triggers.length === 0
                      ? "—"
                      : [...new Set(u.triggers.map((t) => t.template_name))].join(", ")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
