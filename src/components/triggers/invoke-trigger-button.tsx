"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type GroupOption = { id: string; name: string; slug: string; member_count: number };

type Props = {
  triggerId: string;
  recipientPath?: string;
};

export function InvokeTriggerButton({ triggerId, recipientPath = "phone" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<"phone" | "groups" | "all">("phone");
  const [phone, setPhone] = useState("+15551234567");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !triggerId) return;
    fetch(`/api/v1/triggers/${triggerId}/groups`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => (d.success && Array.isArray(d.data) ? setGroups(d.data) : setGroups([])))
      .catch(() => setGroups([]));
  }, [open, triggerId]);

  const canSubmit =
    target === "phone" ||
    (target === "groups" && groups.length > 0 && groupIds.length > 0) ||
    (target === "all" && groups.length > 0);

  const handleInvoke = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = { target, recipient_path: recipientPath };
      if (target === "phone") {
        body.phone = phone;
      } else if (target === "groups") {
        if (groupIds.length === 0) {
          setMessage("Select at least one group");
          setLoading(false);
          return;
        }
        body.group_ids = groupIds;
      }
      const res = await fetch(`/api/v1/triggers/${triggerId}/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        let msg = data.message ?? data.error ?? "Invoke failed";
        if (data.missing_keys?.length) {
          msg += ` Add to body: ${data.missing_keys.join(", ")}`;
        } else if (data.missing_path) {
          msg += ` (path: ${data.missing_path})`;
        }
        setMessage(msg);
        setLoading(false);
        return;
      }
      if (data.data?.summary) {
        setMessage(`Queued for ${data.data.summary.succeeded} recipient(s).`);
      } else {
        setMessage(data.skipped ? `Skipped: ${data.reason}` : data.duplicate ? "Duplicate ignored" : "Message queued.");
      }
      router.refresh();
      setTimeout(() => {
        setOpen(false);
        setMessage(null);
        setGroupIds([]);
      }, 2000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Invoke failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Invoke
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-blanket)]">
          <div className="mx-4 w-full max-w-md rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-medium">Invoke trigger</h3>
            <p className="mb-4 text-sm text-[var(--text-base-secondary)]">
              Send to one number, selected groups (multiselect), or everyone linked to this trigger.
            </p>
            <form onSubmit={handleInvoke}>
              <div className="mb-4 space-y-3">
                <label className="block text-sm font-medium">Send to</label>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="invoke-target"
                        checked={target === "phone"}
                        onChange={() => setTarget("phone")}
                        className="rounded border-[var(--border-base-default)]"
                      />
                      <span className="text-sm">One number</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="invoke-target"
                        checked={target === "groups"}
                        onChange={() => setTarget("groups")}
                        className="rounded border-[var(--border-base-default)]"
                      />
                      <span className="text-sm">Selected groups</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="invoke-target"
                        checked={target === "all"}
                        onChange={() => setTarget("all")}
                        className="rounded border-[var(--border-base-default)]"
                      />
                      <span className="text-sm">Everyone (all linked groups)</span>
                    </label>
                  </div>
                  {(target === "groups" || target === "all") && groups.length === 0 && (
                    <div className="rounded-md border border-[var(--border-base-secondary)] bg-[var(--bg-base-secondary)] p-3 text-sm text-[var(--text-base-secondary)]">
                      <p className="mb-2">No groups linked to this trigger. Add groups in the trigger settings first.</p>
                      <Link
                        href={`/triggers/${triggerId}`}
                        className="inline-flex items-center text-sm font-medium text-[var(--text-brand-default)] hover:underline"
                      >
                        Edit trigger →
                      </Link>
                    </div>
                  )}
                  {target === "groups" && groupIds.length > 0 && (() => {
                    const empty = groups.filter((g) => groupIds.includes(g.id) && g.member_count === 0);
                    return empty.length > 0 ? (
                      <p className="text-xs text-[var(--text-warning-default)]">
                        {empty.length} selected group{empty.length !== 1 ? "s" : ""} have no members and will be skipped.
                      </p>
                    ) : null;
                  })()}
                </div>
              </div>
              {target === "phone" && (
                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium">Phone</label>
                  <Input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+15551234567"
                    required
                  />
                </div>
              )}
              {target === "groups" && groups.length > 0 && (
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium">Groups</label>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-2">
                    {groups.map((g) => (
                      <label key={g.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-[var(--bg-base-secondary)]">
                        <input
                          type="checkbox"
                          checked={groupIds.includes(g.id)}
                          onChange={(e) => {
                            if (e.target.checked) setGroupIds((prev) => [...prev, g.id]);
                            else setGroupIds((prev) => prev.filter((id) => id !== g.id));
                          }}
                          className="rounded border-[var(--border-base-default)]"
                        />
                        <span className="text-sm">{g.name}</span>
                        <span className="text-xs text-[var(--text-base-secondary)]">({g.member_count} members)</span>
                      </label>
                    ))}
                  </div>
                  {groupIds.length > 0 && (
                    <p className="mt-1 text-xs text-[var(--text-base-secondary)]">
                      {groupIds.length} group{groupIds.length !== 1 ? "s" : ""} selected
                    </p>
                  )}
                </div>
              )}
              {message && (
                <p
                  className={`mb-2 text-sm ${
                    message.startsWith("Queued") || message.startsWith("Skipped") || message.startsWith("Duplicate")
                      ? "text-[var(--text-base-default)]"
                      : "text-[var(--text-danger-default)]"
                  }`}
                >
                  {message}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    setMessage(null);
                    setGroupIds([]);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || !canSubmit}>
                  {loading ? "Invoking..." : "Invoke"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
