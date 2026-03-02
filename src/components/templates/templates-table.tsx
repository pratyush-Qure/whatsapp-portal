"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TemplateSubmitButton } from "@/components/templates/template-submit-button";

type TemplateRow = {
  id: string;
  name: string;
  category: string;
  language: string;
  body: string;
  twilio_status: string;
  twilio_rejected_reason: string | null;
  created_at: string | null;
  project_name: string | null;
};

type Props = {
  templates: TemplateRow[];
};

export function TemplatesTable({ templates }: Props) {
  const [selected, setSelected] = useState<TemplateRow | null>(null);

  return (
    <>
      <section className="overflow-x-auto rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)]">
        <Table className="table-fixed min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-64 whitespace-nowrap">Name</TableHead>
              <TableHead className="w-40 whitespace-nowrap">Project</TableHead>
              <TableHead className="w-36 whitespace-nowrap">Category</TableHead>
              <TableHead className="w-28 whitespace-nowrap">Language</TableHead>
              <TableHead className="w-36 whitespace-nowrap">Status</TableHead>
              <TableHead className="w-36 whitespace-nowrap">Created</TableHead>
              <TableHead className="w-28 whitespace-nowrap text-center">Submit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length > 0 ? (
              templates.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(t)}
                >
                  <TableCell className="truncate whitespace-nowrap font-medium" title={t.name}>
                    {t.name}
                  </TableCell>
                  <TableCell className="truncate whitespace-nowrap text-[var(--text-base-secondary)]" title={t.project_name ?? "—"}>
                    {t.project_name ?? "—"}
                  </TableCell>
                  <TableCell className="truncate whitespace-nowrap">{t.category}</TableCell>
                  <TableCell className="truncate whitespace-nowrap">{t.language}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={
                        t.twilio_status === "approved"
                          ? "success"
                          : t.twilio_status === "pending"
                            ? "warning"
                            : t.twilio_status === "rejected"
                              ? "danger"
                              : "neutral"
                      }
                    >
                      {t.twilio_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[var(--text-base-secondary)]">
                    {new Date(t.created_at ?? "").toLocaleDateString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                    {String(t.twilio_status ?? "draft").toLowerCase() === "draft" ? (
                      <TemplateSubmitButton templateId={t.id} />
                    ) : (
                      <span className="text-[var(--text-base-secondary)]">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-[var(--text-base-secondary)]">
                  No templates yet. Create one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-scrim)]/70 p-4" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-2xl rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-base-default)]">{selected.name}</h2>
                <p className="mt-1 text-sm text-[var(--text-base-secondary)]">
                  {selected.project_name ?? "—"} · {selected.category} · {selected.language}
                </p>
              </div>
              <Badge
                variant={
                  selected.twilio_status === "approved"
                    ? "success"
                    : selected.twilio_status === "pending"
                      ? "warning"
                      : selected.twilio_status === "rejected"
                        ? "danger"
                        : "neutral"
                }
              >
                {selected.twilio_status}
              </Badge>
            </div>

            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium text-[var(--text-base-default)]">Template body</h3>
              <div className="max-h-64 overflow-auto rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-secondary)] p-3 text-sm text-[var(--text-base-default)]">
                <p className="whitespace-pre-wrap break-words">{selected.body}</p>
              </div>
              {selected.twilio_status === "rejected" && selected.twilio_rejected_reason && (
                <p className="text-xs text-[var(--text-danger-default)]">{selected.twilio_rejected_reason}</p>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
              <Link href={`/templates/${selected.id}`}>
                <Button type="button">Edit template</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
