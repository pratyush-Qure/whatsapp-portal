import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dispatchByTriggerId, TriggerNotFoundError, RecipientNotFoundError, TemplateNotApprovedError } from "@/lib/engine/dispatcher";
import { z } from "zod";

const bulkSendSchema = z.object({
  triggerId: z.string().uuid(),
  recipients: z
    .array(z.record(z.string(), z.unknown()))
    .min(1)
    .max(100),
  /** ISO date string; when set, messages are scheduled for that time instead of sent immediately */
  scheduledFor: z.string().optional(),
}).refine(
  (data) => data.recipients.every((r) => r.phone != null || r.Phone != null),
  { message: "Each recipient must have a 'phone' field", path: ["recipients"] }
);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = bulkSendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { triggerId, recipients, scheduledFor } = parsed.data;
    const results: { phone: string; job_id?: string; error?: string }[] = [];

    for (const recipient of recipients) {
      const payload = { ...recipient } as Record<string, unknown>;
      if (!payload.phone && payload.Phone) {
        payload.phone = payload.Phone;
      }

      try {
        const result = await dispatchByTriggerId(triggerId, payload, undefined, {
          allowDraft: true,
          ...(scheduledFor && { scheduledFor }),
        });

        if (result.skipped) {
          results.push({
            phone: String(payload.phone ?? ""),
            error: result.reason ?? "Skipped",
          });
        } else if (result.duplicate) {
          results.push({
            phone: String(payload.phone ?? ""),
            job_id: result.message_log_id,
            error: "Duplicate (ignored)",
          });
        } else {
          results.push({
            phone: String(payload.phone ?? ""),
            job_id: result.job_id ?? result.message_log_id,
          });
        }
      } catch (err) {
        if (err instanceof RecipientNotFoundError) {
          results.push({
            phone: String(payload.phone ?? ""),
            error: "Phone number not found or invalid",
          });
        } else {
          results.push({
            phone: String(payload.phone ?? ""),
            error: err instanceof Error ? err.message : "Failed to send",
          });
        }
      }
    }

    const succeeded = results.filter((r) => !r.error || r.error === "Duplicate (ignored)").length;
    const failed = results.filter((r) => r.error && r.error !== "Duplicate (ignored)").length;

    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: { total: recipients.length, succeeded, failed },
      },
    });
  } catch (error) {
    if (error instanceof TriggerNotFoundError) {
      return NextResponse.json(
        { success: false, error: "TRIGGER_NOT_FOUND", message: error.message },
        { status: 404 }
      );
    }
    if (error instanceof TemplateNotApprovedError) {
      return NextResponse.json(
        {
          success: false,
          error: "TEMPLATE_NOT_APPROVED",
          message: error.message,
          twilio_status: error.twilioStatus,
        },
        { status: 400 }
      );
    }
    console.error("Bulk send error:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Bulk send failed" },
      { status: 500 }
    );
  }
}
