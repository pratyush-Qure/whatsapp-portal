import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/channels";
import { interpolateTemplate } from "@/lib/engine/resolver";
import { getMessagingProvider } from "@/lib/messaging-provider";
import { isValidContentSid } from "@/lib/twilio/content";
import { maskPhoneForLog } from "@/lib/utils/phone";

export async function processNextJob(): Promise<boolean> {
  const supabase = createAdminClient();

  let job: Record<string, unknown> | null = null;
  const { data: claimedRows } = await supabase.rpc("claim_next_job");
  if (Array.isArray(claimedRows) && claimedRows.length > 0 && claimedRows[0]) {
    job = claimedRows[0] as Record<string, unknown>;
  }
  if (!job) {
    const { data: fallback } = await supabase
      .from("job_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .lt("attempts", 3)
      .order("scheduled_for", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!fallback) return false;
    job = fallback as Record<string, unknown>;
    const nextAttempt = ((job.attempts as number) ?? 0) + 1;
    await supabase
      .from("job_queue")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
        attempts: nextAttempt,
      })
      .eq("id", job.id);
    job.attempts = nextAttempt;
  }

  const attemptCount = (job.attempts as number) ?? 0;

  const payload = job.payload as {
    message_log_id: string;
    recipient_phone: string;
    resolved_variables: { position: number; value: string }[];
  };

  const { data: messageLog } = await supabase
    .from("message_logs")
    .select("template_id, trigger_id")
    .eq("id", payload.message_log_id)
    .single();

  if (!messageLog) {
    await supabase
      .from("job_queue")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        error_message: "Message log not found",
      })
      .eq("id", job.id);
    return true;
  }

  const { data: trigger } = await supabase
    .from("triggers")
    .select("project_id")
    .eq("id", (messageLog as { trigger_id: string }).trigger_id)
    .single();

  const projectId = (trigger as { project_id?: string } | null)?.project_id;

  if (projectId) {
    const { data: optOut } = await supabase
      .from("opt_outs")
      .select("id")
      .eq("project_id", projectId)
      .eq("phone", payload.recipient_phone)
      .maybeSingle();
    if (optOut) {
      await supabase
        .from("job_queue")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          error_message: "Recipient opted out",
        })
        .eq("id", job.id);
      await supabase
        .from("message_logs")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          error_message: "Recipient opted out",
        })
        .eq("id", payload.message_log_id);
      return true;
    }

    const maxRecipients24h = process.env.MESSAGING_MAX_UNIQUE_RECIPIENTS_24H
      ? parseInt(process.env.MESSAGING_MAX_UNIQUE_RECIPIENTS_24H, 10)
      : 0;
    if (maxRecipients24h > 0) {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: triggerIds } = await supabase
        .from("triggers")
        .select("id")
        .eq("project_id", projectId);
      const ids = (triggerIds ?? []).map((r) => (r as { id: string }).id);
      if (ids.length > 0) {
        const { data: recentLogs } = await supabase
          .from("message_logs")
          .select("recipient_phone")
          .in("trigger_id", ids)
          .in("status", ["sent", "delivered", "read"])
          .gte("sent_at", since24h);
        const unique24h = new Set((recentLogs ?? []).map((r) => (r as { recipient_phone: string }).recipient_phone)).size;
        if (unique24h >= maxRecipients24h) {
          await supabase
            .from("job_queue")
            .update({
              status: "pending",
              scheduled_for: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              error_message: "Rate limit (unique recipients 24h) reached; retrying in 1h",
            })
            .eq("id", job.id);
          return true;
        }
      }
    }
  }

  const { data: template } = await supabase
    .from("templates")
    .select("body, twilio_status, twilio_content_sid")
    .eq("id", messageLog.template_id)
    .single();

  if (!template) {
    await supabase
      .from("job_queue")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        error_message: "Template not found",
      })
      .eq("id", job.id);
    return true;
  }

  const twilioStatus = (template as { twilio_status?: string }).twilio_status ?? "draft";
  if (twilioStatus !== "approved") {
    await supabase
      .from("job_queue")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        error_message: `Template not approved for sending (status: ${twilioStatus}). Submit for approval in Templates.`,
      })
      .eq("id", job.id);
    await supabase
      .from("message_logs")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        error_message: `Template not approved (${twilioStatus})`,
      })
      .eq("id", payload.message_log_id);
    return true;
  }

  const rawContentSid = (template as { twilio_content_sid?: string | null }).twilio_content_sid;
  const contentSid = isValidContentSid(rawContentSid) ? rawContentSid! : null;
  const contentVariables: Record<string, string> | undefined =
    contentSid && payload.resolved_variables?.length
      ? Object.fromEntries(
          payload.resolved_variables.map((v) => [String(v.position), v.value ?? ""])
        )
      : undefined;

  const body = interpolateTemplate(template.body, payload.resolved_variables);

  const provider = getMessagingProvider();
  const result = await sendMessage(provider, null, {
    to: payload.recipient_phone,
    body,
    ...(contentSid && contentVariables && { contentSid, contentVariables }),
  });

  if (!result.success) {
    console.error(
      "Send failed:",
      maskPhoneForLog(payload.recipient_phone),
      result.error_message ?? "unknown"
    );
  }

  const maxAttempts = typeof (job as { max_attempts?: number }).max_attempts === "number"
    ? (job as { max_attempts: number }).max_attempts
    : 3;
  const shouldRetry = !result.success && attemptCount < maxAttempts;

  const updateData: Record<string, unknown> = shouldRetry
    ? {
        status: "pending",
        scheduled_for: new Date(
          Date.now() + Math.min(60 * 1000 * Math.pow(2, attemptCount - 1), 600 * 1000)
        ).toISOString(),
        error_message: result.error_message ?? "Send failed; will retry",
      }
    : {
        status: result.success ? "completed" : "failed",
        [result.success ? "completed_at" : "failed_at"]: new Date().toISOString(),
      };
  if (!result.success && !shouldRetry) {
    updateData.error_message = result.error_message;
  }

  await supabase.from("job_queue").update(updateData).eq("id", job.id);

  if (!shouldRetry) {
    await supabase
      .from("message_logs")
      .update({
        status: result.success ? "sent" : "failed",
        twilio_message_sid: result.message_sid ?? null,
        sent_at: result.success ? new Date().toISOString() : null,
        failed_at: !result.success ? new Date().toISOString() : null,
        error_code: result.error_code ?? null,
        error_message: result.error_message ?? null,
      })
      .eq("id", payload.message_log_id);
  }

  return true;
}
