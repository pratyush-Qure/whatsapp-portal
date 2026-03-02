import { createAdminClient } from "@/lib/supabase/admin";
import { fetchApprovalStatus, isValidContentSid } from "@/lib/twilio/content";

/**
 * Poll Twilio for approval status of all templates in "pending" and update Supabase.
 * Call from cron (e.g. every 15 min) so template status stays in sync with Meta.
 */
export async function syncPendingTemplatesApprovalStatus(maxCount = 20): Promise<number> {
  const supabase = createAdminClient();
  const { data: templates } = await supabase
    .from("templates")
    .select("id, project_id, twilio_content_sid")
    .eq("twilio_status", "pending")
    .not("twilio_content_sid", "is", null)
    .limit(maxCount);

  if (!templates?.length) return 0;
  let synced = 0;
  for (const t of templates) {
    const contentSid = (t as { twilio_content_sid?: string }).twilio_content_sid;
    if (!contentSid || !isValidContentSid(contentSid)) continue;
    try {
      const { status, rejection_reason } = await fetchApprovalStatus(contentSid, {
        project_id: (t as { project_id: string }).project_id,
      });
      const dbStatus = status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending";
      const { error } = await supabase
        .from("templates")
        .update({
          twilio_status: dbStatus,
          twilio_rejected_reason: rejection_reason ?? null,
        })
        .eq("id", t.id);
      if (!error) synced++;
    } catch {
      // Skip on error (e.g. rate limit or network)
    }
  }
  return synced;
}
