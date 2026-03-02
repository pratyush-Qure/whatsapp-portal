"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Member = { id: string; phone: string; name: string | null };

type Props = { groupId: string; projectSlug: string };

export function GroupMembersSection({ groupId, projectSlug }: Props) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  const load = () => {
    fetch(`/api/v1/groups/${groupId}/members`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => (d.success && Array.isArray(d.data) ? setMembers(d.data) : setMembers([])))
      .catch(() => setMembers([]));
  };

  useEffect(() => {
    load();
  }, [groupId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: phone.trim(), name: name.trim() || undefined }),
      });
      if (res.ok) {
        setPhone("");
        setName("");
        load();
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    const lines = pasteText.split(/[\n\r]+/).filter((l) => l.trim());
    const membersToAdd = lines.map((line) => {
      const parts = line.split(/[\t,;]+/).map((p) => p.trim());
      return { phone: parts[0] ?? "", name: parts[1] ?? undefined };
    }).filter((m) => m.phone);
    if (membersToAdd.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ members: membersToAdd }),
      });
      if (res.ok) {
        setPasteText("");
        setShowPaste(false);
        load();
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/groups/${groupId}/members/${memberId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        load();
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
      <h2 className="text-sm font-medium text-[var(--text-base-default)]">Group members</h2>
      <p className="mt-1 text-xs text-[var(--text-base-secondary)]">
        Everyone in this table receives messages when a linked trigger is invoked for this group. Add more people below.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <span className="text-xs font-medium text-[var(--text-base-secondary)]">Add to group:</span>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="sr-only">Phone</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+15551234567"
              className="w-40"
            />
          </div>
          <div>
            <label className="sr-only">Name (optional)</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
              className="w-36"
            />
          </div>
          <Button type="submit" size="sm" disabled={loading || !phone.trim()}>
            Add one
          </Button>
        </form>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowPaste(true)} disabled={loading}>
          Paste list (add many)
        </Button>
      </div>
      {showPaste && (
        <div className="mt-4 rounded border border-[var(--border-base-default)] bg-[var(--bg-base-secondary)] p-3">
          <p className="mb-2 text-xs text-[var(--text-base-secondary)]">
            One per line. Optionally: phone then name, separated by comma or tab.
          </p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={4}
            className="mb-2 w-full rounded border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-2 py-1 font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePaste} disabled={loading || !pasteText.trim()}>
              Add all
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowPaste(false); setPasteText(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <div className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone number</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-4 text-center text-sm text-[var(--text-base-secondary)]">
                  No members yet. Add phones above or paste a list.
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-sm">{m.phone}</TableCell>
                  <TableCell className="text-sm">{m.name ?? "—"}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(m.id)}
                      disabled={loading}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
