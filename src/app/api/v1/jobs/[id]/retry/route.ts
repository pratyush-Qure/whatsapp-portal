import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueMessageJob } from "@/lib/queue/pg-cron";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const supabase = createAdminClient();
    const { id } = await context.params;

    const { data: job, error } = await supabase
      .from("job_queue")
      .select("payload, status")
      .eq("id", id)
      .single();

    if (error || !job) {
      return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (job.status !== "failed") {
      return NextResponse.json(
        { success: false, error: "INVALID_STATE", message: "Only failed jobs can be retried" },
        { status: 400 }
      );
    }

    const raw = job.payload as Record<string, unknown>;
    const payload = {
      message_log_id: raw.message_log_id as string,
      trigger_id: raw.trigger_id as string,
      template_id: raw.template_id as string,
      recipient_phone: raw.recipient_phone as string,
      resolved_variables: (raw.resolved_variables ?? []) as { position: number; value: string }[],
    };

    const newJobId = await enqueueMessageJob(payload);

    return NextResponse.json({
      success: true,
      original_job_id: id,
      new_job_id: newJobId,
      queued: true,
      message: "Job re-queued for retry",
    });
  } catch (err) {
    console.error("Job retry error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
