"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";

type TriggerWithVars = {
  id: string;
  slug: string;
  name: string;
  template_id: string | null;
  recipient_path: string;
  templates: { id: string; name: string; body: string } | null;
  variables: { position: number; name: string; payload_path: string | null; type: string }[];
};

type RecipientRow = Record<string, string> & { phone: string };

type SendResult = {
  phone: string;
  job_id?: string;
  error?: string;
};

type GroupOption = { id: string; name: string; slug: string; default_trigger_id?: string | null };

type Props = {
  triggers: TriggerWithVars[];
  projectId?: string;
};

const COUNTRY_OPTIONS = [
  { label: "US (+1)", code: "+1" },
  { label: "India (+91)", code: "+91" },
  { label: "UK (+44)", code: "+44" },
  { label: "UAE (+971)", code: "+971" },
  { label: "Singapore (+65)", code: "+65" },
  { label: "Australia (+61)", code: "+61" },
] as const;

const DEFAULT_COUNTRY_CODE = COUNTRY_OPTIONS[0].code;

function normalizeLocalPhone(input: string): string {
  return (input || "").replace(/[^\d]/g, "");
}

function splitPhoneForUi(rawPhone: string): { countryCode: string; local: string } {
  const value = (rawPhone || "").trim();
  if (!value) return { countryCode: DEFAULT_COUNTRY_CODE, local: "" };
  if (!value.startsWith("+")) {
    return { countryCode: DEFAULT_COUNTRY_CODE, local: normalizeLocalPhone(value) };
  }
  const matched = [...COUNTRY_OPTIONS]
    .sort((a, b) => b.code.length - a.code.length)
    .find((c) => value.startsWith(c.code));
  if (!matched) {
    return { countryCode: DEFAULT_COUNTRY_CODE, local: normalizeLocalPhone(value) };
  }
  return {
    countryCode: matched.code,
    local: normalizeLocalPhone(value.slice(matched.code.length)),
  };
}

function getRowCountryCode(row: RecipientRow): string {
  return row.phone_country || splitPhoneForUi(row.phone).countryCode;
}

function getRowLocalPhone(row: RecipientRow): string {
  if (row.phone_local) return row.phone_local;
  return splitPhoneForUi(row.phone).local;
}

function buildE164FromRow(row: RecipientRow): string {
  const raw = (row.phone || "").trim();
  if (raw.startsWith("+")) return raw;
  const local = normalizeLocalPhone(getRowLocalPhone(row));
  if (!local) return "";
  const code = getRowCountryCode(row) || DEFAULT_COUNTRY_CODE;
  return `${code}${local}`;
}

function formatLabel(path: string | null, name: string): string {
  if (!path) return name;
  return path
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function BulkSendTable({ triggers, projectId }: Props) {
  const searchParams = useSearchParams();
  const projectParam = searchParams.get("project");
  const createTriggerHref = projectParam ? `/triggers/new?project=${encodeURIComponent(projectParam)}` : "/triggers/new";
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerWithVars | null>(
    triggers[0] ?? null
  );
  const [rows, setRows] = useState<RecipientRow[]>([
    { phone: "", phone_country: DEFAULT_COUNTRY_CODE, phone_local: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loadGroupId, setLoadGroupId] = useState("");
  const [sendAllGroupsResult, setSendAllGroupsResult] = useState<{ succeeded: number; failed: number } | null>(null);
  type SendMode = "now" | "schedule" | "recurring";
  const [sendMode, setSendMode] = useState<SendMode>("now");
  const [scheduleAt, setScheduleAt] = useState("");
  const [recurringType, setRecurringType] = useState<"daily" | "weekly">("daily");
  const [recurringTime, setRecurringTime] = useState("09:00");
  const [recurringEndType, setRecurringEndType] = useState<"until_date" | "after_count" | "never">("never");
  const [recurringEndDate, setRecurringEndDate] = useState("");
  const [recurringEndCount, setRecurringEndCount] = useState(10);
  type RecurringRow = {
    id: string;
    trigger_id: string;
    recipient_payload: { phone?: string };
    recurrence_type: string;
    time_of_day: string;
    end_type: string;
    run_count: number;
    next_run_at: string;
    status: string;
    triggers: { name?: string; slug?: string } | null;
  };
  const [recurringList, setRecurringList] = useState<RecurringRow[]>([]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/v1/groups?project_id=${encodeURIComponent(projectId)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => (d.success && Array.isArray(d.data) ? setGroups(d.data) : setGroups([])))
      .catch(() => setGroups([]));
  }, [projectId]);

  const refreshRecurringList = () => {
    if (!projectId) return;
    fetch(`/api/v1/send/recurring?project_id=${encodeURIComponent(projectId)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => (d.success && Array.isArray(d.data) ? setRecurringList(d.data) : setRecurringList([])))
      .catch(() => setRecurringList([]));
  };

  useEffect(() => {
    if (!projectId) return;
    refreshRecurringList();
  }, [projectId]);

  const variables = selectedTrigger?.variables ?? [];
  const varColumns = variables.map((v) => ({
    key: v.payload_path ?? v.name,
    label: formatLabel(v.payload_path, v.name),
  }));

  const addRow = () => {
    const newRow: RecipientRow = { phone: "", phone_country: DEFAULT_COUNTRY_CODE, phone_local: "" };
    for (const v of varColumns) {
      newRow[v.key] = "";
    }
    setRows((prev) => (prev.length === 0 ? [newRow] : [...prev, newRow]));
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: string, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSend = async () => {
    if (!selectedTrigger) {
      setError("Select a trigger first");
      return;
    }

    const validRows = rows.filter((r) => buildE164FromRow(r));
    if (validRows.length === 0) {
      setError("Add at least one phone number");
      return;
    }

    if (sendMode === "schedule" && !scheduleAt) {
      setError("Pick a date and time for the schedule");
      return;
    }
    if (sendMode === "recurring" && !projectId) {
      setError("Project is required for recurring sends");
      return;
    }
    if (sendMode === "recurring" && recurringEndType === "until_date" && !recurringEndDate) {
      setError("Pick an end date for the recurrence");
      return;
    }
    if (sendMode === "recurring" && recurringEndType === "after_count" && (recurringEndCount < 1 || recurringEndCount > 999)) {
      setError("End after count must be 1–999");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const recipients = validRows.map((r) => {
        const payload: Record<string, unknown> = { phone: buildE164FromRow(r) };
        for (const v of varColumns) {
          const val = r[v.key]?.trim();
          if (val) payload[v.key] = val;
        }
        return payload;
      });

      if (sendMode === "recurring") {
        const resultsList: SendResult[] = [];
        for (const rec of recipients) {
          try {
            const res = await fetch("/api/v1/send/recurring", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                triggerId: selectedTrigger.id,
                projectId,
                recipient: rec,
                recurrence: { type: recurringType, timeOfDay: recurringTime, timezone: "UTC" },
                endCondition: {
                  type: recurringEndType,
                  value:
                    recurringEndType === "until_date"
                      ? new Date(recurringEndDate).toISOString()
                      : recurringEndType === "after_count"
                        ? recurringEndCount
                        : undefined,
                },
              }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Failed");
            resultsList.push({ phone: String(rec.phone), job_id: data.data?.id });
          } catch (e) {
            resultsList.push({
              phone: String(rec.phone),
              error: e instanceof Error ? e.message : "Failed",
            });
          }
        }
        setResults(resultsList);
        refreshRecurringList();
        setLoading(false);
        return;
      }

      const body: { triggerId: string; recipients: Record<string, unknown>[]; scheduledFor?: string } = {
        triggerId: selectedTrigger.id,
        recipients,
      };
      if (sendMode === "schedule" && scheduleAt) {
        body.scheduledFor = new Date(scheduleAt).toISOString();
      }

      const res = await fetch("/api/v1/send/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Failed to send");
      }

      setResults(data.data?.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setLoading(false);
    }
  };

  const onTriggerChange = (id: string) => {
    const t = triggers.find((tr) => tr.id === id);
    setSelectedTrigger(t ?? null);
    setRows([{ phone: "", phone_country: DEFAULT_COUNTRY_CODE, phone_local: "" }]);
    setResults(null);
    setError(null);
  };

  const handlePaste = () => {
    const lines = pasteText.split(/[\n\r]+/).filter((l) => l.trim());
    const newRows: RecipientRow[] = [];
    for (const line of lines) {
      const parts = line.split(/[\t,;]+/).map((p) => p.trim());
      if (parts[0]) {
        const parsed = splitPhoneForUi(parts[0]);
        const row: RecipientRow = {
          phone: parts[0],
          phone_country: parsed.countryCode,
          phone_local: parsed.local,
        };
        varColumns.forEach((col, i) => {
          row[col.key] = parts[i + 1] ?? "";
        });
        newRows.push(row);
      }
    }
    if (newRows.length > 0) {
      setRows((prev) => (prev.some((r) => r.phone) ? [...prev, ...newRows] : newRows));
      setShowPasteModal(false);
      setPasteText("");
    }
  };

  const handleLoadFromGroup = async () => {
    if (!loadGroupId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/groups/${loadGroupId}/members`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Failed to load group");
      const members = (data.data ?? []) as { phone: string; name?: string | null }[];
      const group = groups.find((g) => g.id === loadGroupId);
      const newRows: RecipientRow[] = members.map((m) => {
        const phone = m.phone?.trim() ?? "";
        const parsed = splitPhoneForUi(phone);
        const row: RecipientRow = {
          phone,
          phone_country: parsed.countryCode,
          phone_local: parsed.local,
        };
        if (varColumns.length > 0 && varColumns[0].key === "name") row.name = (m.name ?? "").trim();
        else if (varColumns.length > 0) row[varColumns[0].key] = (m.name ?? "").trim();
        varColumns.forEach((col) => {
          if (!(col.key in row)) row[col.key] = "";
        });
        return row;
      });
      setRows(
        newRows.length ? newRows : [{ phone: "", phone_country: DEFAULT_COUNTRY_CODE, phone_local: "" }]
      );
      setSendAllGroupsResult(null);
      if (group?.default_trigger_id) {
        const trigger = triggers.find((t) => t.id === group.default_trigger_id);
        if (trigger) setSelectedTrigger(trigger);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load group");
    } finally {
      setLoading(false);
    }
  };

  const handleSendToAllGroups = async () => {
    if (!selectedTrigger) {
      setError("Select a trigger first");
      return;
    }
    setLoading(true);
    setError(null);
    setSendAllGroupsResult(null);
    try {
      const res = await fetch(`/api/v1/triggers/${selectedTrigger.id}/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target: "all" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Failed to send");
      const summary = data.data?.summary;
      if (summary) {
        setSendAllGroupsResult({ succeeded: summary.succeeded, failed: summary.failed ?? 0 });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send to all groups failed");
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setResults(null);
    setError(null);
  };

  if (triggers.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-8 text-center">
        <p className="text-[var(--text-base-secondary)]">
          No triggers yet. Create a trigger with a template to send messages.
        </p>
        <Link
          href={createTriggerHref}
          className="mt-4 inline-block rounded-md bg-[var(--bg-brand-default)] px-4 py-2 text-sm font-medium text-[var(--text-brand-on-brand)] hover:opacity-90"
        >
          Create Trigger
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px]">
          <label className="mb-1 block text-sm font-medium text-[var(--text-base-secondary)]">
            Template (Trigger)
          </label>
          <select
            value={selectedTrigger?.id ?? ""}
            onChange={(e) => onTriggerChange(e.target.value)}
            className="w-full rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-3 py-2 text-sm"
          >
            <option value="">Select trigger</option>
            {triggers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.slug})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={addRow} disabled={loading}>
            Add row
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPasteModal(true)}
            disabled={loading}
          >
            Paste
          </Button>
          {groups.length > 0 && (
            <>
              <select
                value={loadGroupId}
                onChange={(e) => setLoadGroupId(e.target.value)}
                className="rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-3 py-2 text-sm"
              >
                <option value="">Load from group...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                onClick={handleLoadFromGroup}
                disabled={loading || !loadGroupId}
              >
                Load
              </Button>
            </>
          )}
          {selectedTrigger && (
            <Button
              type="button"
              variant="outline"
              onClick={handleSendToAllGroups}
              disabled={loading}
              title="Send to everyone in all groups linked to this trigger"
            >
              {loading ? "Sending..." : "Send to all linked groups"}
            </Button>
          )}
          <Button onClick={handleSend} disabled={loading}>
            {loading ? "Sending..." : sendMode === "recurring" ? "Create recurring" : "Send all"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-secondary)] px-4 py-3">
          <span className="text-sm font-medium text-[var(--text-base-secondary)]">Send</span>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="sendMode"
              checked={sendMode === "now"}
              onChange={() => setSendMode("now")}
              className="rounded-full border-[var(--border-base-default)]"
            />
            <span className="text-sm">Now</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="sendMode"
              checked={sendMode === "schedule"}
              onChange={() => setSendMode("schedule")}
              className="rounded-full border-[var(--border-base-default)]"
            />
            <span className="text-sm">Schedule</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="sendMode"
              checked={sendMode === "recurring"}
              onChange={() => setSendMode("recurring")}
              className="rounded-full border-[var(--border-base-default)]"
            />
            <span className="text-sm">Recurring</span>
          </label>

          {sendMode === "schedule" && (
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-3 py-2 text-sm"
              />
            </div>
          )}

          {sendMode === "recurring" && (
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={recurringType}
                onChange={(e) => setRecurringType(e.target.value as "daily" | "weekly")}
                className="rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-3 py-2 text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
              <input
                type="time"
                value={recurringTime}
                onChange={(e) => setRecurringTime(e.target.value)}
                className="rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-3 py-2 text-sm"
              />
              <span className="text-sm text-[var(--text-base-secondary)]">until</span>
              <select
                value={recurringEndType}
                onChange={(e) => setRecurringEndType(e.target.value as "until_date" | "after_count" | "never")}
                className="rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-3 py-2 text-sm"
              >
                <option value="never">Never</option>
                <option value="until_date">Date</option>
                <option value="after_count">After N sends</option>
              </select>
              {recurringEndType === "until_date" && (
                <input
                  type="date"
                  value={recurringEndDate}
                  onChange={(e) => setRecurringEndDate(e.target.value)}
                  className="rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-3 py-2 text-sm"
                />
              )}
              {recurringEndType === "after_count" && (
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={recurringEndCount}
                  onChange={(e) => setRecurringEndCount(parseInt(e.target.value, 10) || 1)}
                  className="w-20 rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-3 py-2 text-sm"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {projectId && recurringList.length > 0 && (
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <h3 className="mb-2 text-sm font-medium text-[var(--text-base-default)]">Recurring schedules</h3>
          <ul className="space-y-2">
            {recurringList.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--border-base-default)] px-3 py-2 text-sm"
              >
                <span className="font-mono text-[var(--text-base-secondary)]">{r.recipient_payload?.phone ?? "—"}</span>
                <span className="text-[var(--text-base-secondary)]">
                  {(r.triggers as { name?: string })?.name ?? r.trigger_id} · {r.recurrence_type} at {r.time_of_day}
                </span>
                <span className="text-xs text-[var(--text-base-secondary)]">
                  next: {r.next_run_at ? new Date(r.next_run_at).toLocaleString() : "—"} · runs: {r.run_count}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const res = await fetch(`/api/v1/send/recurring/${r.id}`, {
                      method: "DELETE",
                      credentials: "include",
                    });
                    if (res.ok) setRecurringList((prev) => prev.filter((x) => x.id !== r.id));
                  }}
                >
                  Cancel
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sendAllGroupsResult != null && (
        <div className="rounded-md bg-[var(--bg-success-default)]/20 px-3 py-2 text-sm text-[var(--text-success-default)]">
          Sent to {sendAllGroupsResult.succeeded} recipient(s)
          {sendAllGroupsResult.failed > 0 && `; ${sendAllGroupsResult.failed} failed`}.
        </div>
      )}

      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-blanket)]">
          <div className="mx-4 w-full max-w-lg rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-medium">Paste phone numbers</h3>
            <p className="mb-2 text-sm text-[var(--text-base-secondary)]">
              One row per line. Separate columns with comma, tab, or semicolon.
            </p>
            <p className="mb-4 text-xs text-[var(--text-base-secondary)]">
              Column order: <span className="font-mono">phone</span>
              {varColumns.map((c) => (
                <span key={c.key}>
                  {" → "}
                  <span className="font-mono">{c.key}</span>
                </span>
              ))}
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={varColumns.length ? `+15551234567, value1, value2\n+15559876543, value1, value2` : "+15551234567\n+15559876543"}
              rows={6}
              className="mb-4 w-full rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-secondary)] px-3 py-2 font-mono text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowPasteModal(false); setPasteText(""); }}>
                Cancel
              </Button>
              <Button onClick={handlePaste}>Add rows</Button>
            </div>
          </div>
        </div>
      )}

      {selectedTrigger && (
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">Template preview</h3>
            {selectedTrigger.template_id && (
              <Link
                href={`/templates/${selectedTrigger.template_id}`}
                className="text-xs text-[var(--text-brand-default)] hover:underline"
              >
                Edit template & variables
              </Link>
            )}
          </div>
          <p className="mb-3 whitespace-pre-wrap rounded bg-[var(--bg-base-secondary)] px-3 py-2 font-mono text-sm">
            {selectedTrigger.templates?.body ?? "—"}
          </p>
          {varColumns.length > 0 && (
            <div className="text-xs text-[var(--text-base-secondary)]">
              <span className="font-medium">Columns to fill:</span>{" "}
              <span className="font-mono">phone</span>
              {varColumns.map((c) => (
                <span key={c.key}>
                  , <span className="font-mono">{c.key}</span>
                </span>
              ))}
              {" "}(order: phone first, then variables left to right)
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-[var(--bg-danger-default)]/20 px-4 py-2 text-sm text-[var(--text-danger-default)]">
          {error}
        </div>
      )}

      {results && (
        <div className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Send results</p>
              <p className="mt-1 text-xs text-[var(--text-base-secondary)]">
                {results.filter((r) => !r.error || r.error === "Duplicate (ignored)").length} queued
                {results.some((r) => r.error && r.error !== "Duplicate (ignored)") && (
                  <> · {results.filter((r) => r.error && r.error !== "Duplicate (ignored)").length} failed</>
                )}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={clearResults}>
              Clear
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded border border-[var(--border-base-default)] px-3 py-2 text-sm"
              >
                <span className="truncate font-mono">{r.phone}</span>
                {r.error ? (
                  <Badge variant="danger">{r.error}</Badge>
                ) : (
                  <Badge variant="success">Queued</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[320px]" title="Recipient phone (country code + local number)">
                Phone
              </TableHead>
              {varColumns.map((v) => (
                <TableHead key={v.key} title={`Payload key: ${v.key}`}>
                  {v.label}
                </TableHead>
              ))}
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-2">
                    <select
                      value={getRowCountryCode(row)}
                      onChange={(e) => {
                        const code = e.target.value;
                        const local = getRowLocalPhone(row);
                        updateRow(index, "phone_country", code);
                        updateRow(index, "phone_local", local);
                        updateRow(index, "phone", local ? `${code}${normalizeLocalPhone(local)}` : "");
                      }}
                      className="h-10 rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-2 py-2 text-sm"
                    >
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={getRowLocalPhone(row)}
                      onChange={(e) => {
                        const local = normalizeLocalPhone(e.target.value);
                        const code = getRowCountryCode(row);
                        updateRow(index, "phone_local", local);
                        updateRow(index, "phone_country", code);
                        updateRow(index, "phone", local ? `${code}${local}` : "");
                      }}
                      placeholder="5551234567"
                      className="min-w-0 font-mono text-sm"
                    />
                  </div>
                </TableCell>
                {varColumns.map((v) => (
                  <TableCell key={v.key}>
                    <Input
                      value={row[v.key] ?? ""}
                      onChange={(e) => updateRow(index, v.key, e.target.value)}
                      placeholder={v.label}
                      className="text-sm"
                    />
                  </TableCell>
                ))}
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(index)}
                    disabled={rows.length <= 1}
                  >
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedTrigger && variables.length === 0 && (
        <p className="text-sm text-[var(--text-base-secondary)]">
          This template has no variables. Add phone numbers and click Send.
        </p>
      )}
    </div>
  );
}
