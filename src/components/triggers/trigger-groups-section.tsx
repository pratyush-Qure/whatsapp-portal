"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type GroupRow = { id: string; name: string; slug: string; member_count: number };

type Props = {
  triggerId: string;
  projectSlug: string;
  projectId: string;
};

export function TriggerGroupsSection({ triggerId, projectSlug, projectId }: Props) {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [allGroups, setAllGroups] = useState<{ id: string; name: string }[]>([]);
  const [addGroupId, setAddGroupId] = useState("");
  const [loading, setLoading] = useState(false);

  const load = () => {
    Promise.all([
      fetch(`/api/v1/triggers/${triggerId}/groups`, { credentials: "include" }).then((r) => r.json()),
      fetch(`/api/v1/groups?project_id=${projectId}`, { credentials: "include" }).then((r) => r.json()),
    ]).then(([linked, all]) => {
      if (linked.success && Array.isArray(linked.data)) setGroups(linked.data);
      if (all.success && Array.isArray(all.data)) setAllGroups(all.data);
    });
  };

  useEffect(() => {
    load();
  }, [triggerId, projectId]);

  const handleAdd = async () => {
    if (!addGroupId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/triggers/${triggerId}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ group_id: addGroupId }),
      });
      if (res.ok) {
        setAddGroupId("");
        load();
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (groupId: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/triggers/${triggerId}/groups?group_id=${encodeURIComponent(groupId)}`,
        { method: "DELETE", credentials: "include" }
      );
      if (res.ok) {
        load();
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const linkedIds = new Set(groups.map((g) => g.id));
  const availableToAdd = allGroups.filter((g) => !linkedIds.has(g.id));

  return (
    <section className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
      <h2 className="text-sm font-medium text-[var(--text-base-default)]">Groups</h2>
      <p className="mt-1 text-xs text-[var(--text-base-secondary)]">
        When this trigger is invoked for a group or &quot;everyone&quot;, messages go to members of these groups.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {availableToAdd.length > 0 && (
          <>
            <select
              value={addGroupId}
              onChange={(e) => setAddGroupId(e.target.value)}
              className="rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-3 py-2 text-sm"
            >
              <option value="">Add group...</option>
              {availableToAdd.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <Button type="button" size="sm" onClick={handleAdd} disabled={loading || !addGroupId}>
              Add
            </Button>
          </>
        )}
        <Link
          href={`/groups?project=${encodeURIComponent(projectSlug)}`}
          className="text-sm text-[var(--text-brand-default)] hover:underline"
        >
          Manage groups
        </Link>
      </div>
      {groups.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {groups.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between rounded border border-[var(--border-base-secondary)] px-3 py-2 text-sm"
            >
              <Link
                href={`/groups/${g.id}?project=${encodeURIComponent(projectSlug)}`}
                className="font-medium text-[var(--text-base-default)] hover:underline"
              >
                {g.name}
              </Link>
              <span className="text-[var(--text-base-secondary)]">{g.member_count} members</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(g.id)}
                disabled={loading}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--text-base-secondary)]">No groups linked. Add a group to invoke by group or &quot;everyone&quot;.</p>
      )}
    </section>
  );
}
