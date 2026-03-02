import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchByTriggerId } from "@/lib/engine/dispatcher";
import { getNextRunAtISO } from "./next-run";

export async function processNextRecurring(): Promise<boolean> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: row, error: fetchError } = await supabase
    .from("scheduled_recurring")
    .select("id, trigger_id, recipient_payload, recurrence_type, time_of_day, end_type, end_date, end_after_count, run_count, last_run_at")
    .eq("status", "active")
    .lte("next_run_at", now)
    .order("next_run_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fetchError || !row) return false;

  const payload = row.recipient_payload as Record<string, unknown>;

  try {
    await dispatchByTriggerId(row.trigger_id, payload, undefined, { allowDraft: true });
  } catch (err) {
    console.error("Recurring dispatch error:", err);
    await supabase
      .from("scheduled_recurring")
      .update({
        next_run_at: getNextRunAtISO(
          row.recurrence_type as "daily" | "weekly",
          row.time_of_day,
          new Date()
        ),
      })
      .eq("id", row.id);
    return true;
  }

  const newRunCount = (row.run_count ?? 0) + 1;
  const nowDate = new Date();

  let status: string = "active";
  if (row.end_type === "after_count" && row.end_after_count != null && newRunCount >= row.end_after_count) {
    status = "completed";
  } else if (row.end_type === "until_date" && row.end_date != null && new Date(row.end_date) <= nowDate) {
    status = "completed";
  }

  const nextRunAt =
    status === "active"
      ? getNextRunAtISO(
          row.recurrence_type as "daily" | "weekly",
          row.time_of_day,
          nowDate
        )
      : now;

  await supabase
    .from("scheduled_recurring")
    .update({
      last_run_at: now,
      run_count: newRunCount,
      next_run_at: nextRunAt,
      status,
      updated_at: now,
    })
    .eq("id", row.id);

  return true;
}
