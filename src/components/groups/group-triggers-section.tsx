"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

type LinkedTrigger = { id: string; name: string; slug: string };

type Props = {
  groupId: string;
  groupName: string;
  linkedTriggers: LinkedTrigger[];
  projectSlug: string;
};

export function GroupTriggersSection({ groupId, groupName, linkedTriggers, projectSlug }: Props) {
  const router = useRouter();
  const [invokingId, setInvokingId] = useState<string | null>(null);
  const [invokingAll, setInvokingAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleInvoke = async (triggerId: string) => {
    setInvokingId(triggerId);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/triggers/${triggerId}/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target: "group", group_id: groupId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message ?? data.error ?? "Invoke failed");
        return;
      }
      const summary = data.data?.summary;
      setMessage(
        summary
          ? `Sent to ${summary.succeeded} member(s)`
          : data.skipped
            ? `Skipped: ${data.reason}`
            : "Sent."
      );
      router.refresh();
    } catch {
      setMessage("Invoke failed");
    } finally {
      setInvokingId(null);
    }
  };

  const handleInvokeAll = async () => {
    setInvokingAll(true);
    setMessage(null);
    let totalSent = 0;
    let errors: string[] = [];
    try {
      for (const t of linkedTriggers) {
        const res = await fetch(`/api/v1/triggers/${t.id}/invoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ target: "group", group_id: groupId }),
        });
        const data = await res.json();
        if (res.ok && data.data?.summary) {
          totalSent += data.data.summary.succeeded ?? 0;
        } else if (!res.ok) {
          errors.push(`${t.name}: ${data.message ?? data.error ?? "failed"}`);
        }
      }
      setMessage(
        errors.length === 0
          ? `All ${linkedTriggers.length} trigger(s) invoked; messages queued for group members.`
          : `Invoked; ${totalSent} sent. Errors: ${errors.join("; ")}`
      );
      router.refresh();
    } catch {
      setMessage("Invoke all failed");
    } finally {
      setInvokingAll(false);
    }
  };

  if (linkedTriggers.length === 0) {
    return (
      <section className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
        <h2 className="text-sm font-medium text-[var(--text-base-default)]">Triggers linked to this group</h2>
        <p className="mt-1 text-xs text-[var(--text-base-secondary)]">
          No triggers linked yet. Link triggers from the trigger page (Triggers → Edit trigger → Groups) or set a default trigger when editing this group above.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-[var(--text-base-default)]">Triggers linked to this group</h2>
          <p className="mt-1 text-xs text-[var(--text-base-secondary)]">
            When you invoke a trigger for this group, all members receive that message. Invoke one trigger or all.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleInvokeAll}
          disabled={invokingAll || linkedTriggers.length === 0}
        >
          {invokingAll ? "Invoking all…" : "Invoke all triggers"}
        </Button>
      </div>
      {message && (
        <p className="mt-2 text-sm text-[var(--text-base-default)]">{message}</p>
      )}
      <div className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trigger</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linkedTriggers.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="font-mono text-xs">{t.slug}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleInvoke(t.id)}
                      disabled={invokingId !== null || invokingAll}
                    >
                      {invokingId === t.id ? "Invoking…" : "Invoke"}
                    </Button>
                    <Link
                      href={`/triggers/${t.id}?project=${encodeURIComponent(projectSlug)}`}
                      className="text-xs text-[var(--text-brand-default)] hover:underline"
                    >
                      Edit
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
