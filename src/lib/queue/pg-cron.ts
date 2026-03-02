import { createAdminClient } from "@/lib/supabase/admin";
import { nanoid } from "nanoid";

export type MessageJobPayload = {
  message_log_id: string;
  trigger_id: string;
  template_id: string;
  recipient_phone: string;
  resolved_variables: { position: number; value: string }[];
};

export type EnqueueOptions = {
  /** When to run the job. Default: now. */
  scheduledFor?: Date | string;
};

export async function enqueueMessageJob(
  payload: MessageJobPayload,
  opts?: EnqueueOptions
): Promise<string> {
  const supabase = createAdminClient();
  const jobId = `job_${nanoid(8)}`;
  const scheduledFor = opts?.scheduledFor
    ? new Date(opts.scheduledFor).toISOString()
    : new Date().toISOString();

  const { data: job, error } = await supabase
    .from("job_queue")
    .insert({
      trigger_id: payload.trigger_id,
      message_log_id: payload.message_log_id,
      status: "pending",
      payload: payload as unknown as Record<string, unknown>,
      priority: 0,
      scheduled_for: scheduledFor,
    })
    .select("id")
    .single();

  if (error) throw error;
  return job?.id ?? jobId;
}
