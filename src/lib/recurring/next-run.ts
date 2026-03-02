/**
 * Compute next run time for a recurring schedule.
 * time_of_day is "HH:mm" in 24h (UTC). fromDate is the reference (e.g. last_run_at or now).
 */
export function getNextRunAt(
  recurrenceType: "daily" | "weekly",
  timeOfDay: string,
  fromDate: Date = new Date()
): Date {
  const [hours, minutes] = timeOfDay.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return new Date(fromDate.getTime() + 24 * 60 * 60 * 1000);
  }

  const next = new Date(fromDate);
  next.setUTCHours(hours, minutes, 0, 0);

  if (next <= fromDate) {
    next.setUTCDate(next.getUTCDate() + (recurrenceType === "weekly" ? 7 : 1));
  }
  return next;
}

export function getNextRunAtISO(
  recurrenceType: "daily" | "weekly",
  timeOfDay: string,
  fromDate: Date = new Date()
): string {
  return getNextRunAt(recurrenceType, timeOfDay, fromDate).toISOString();
}
