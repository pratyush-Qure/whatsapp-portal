import { NextResponse } from "next/server";
import { z } from "zod";
import { dispatchMessage, TriggerNotFoundError, RecipientNotFoundError, TemplateNotApprovedError } from "@/lib/engine/dispatcher";
import { inboundPayloadSchema } from "@/lib/utils/validation";

type Context = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { slug: triggerSlug } = await context.params;
    const rawBody = await request.text();
    const body = JSON.parse(rawBody || "{}") as unknown;
    const parsed = inboundPayloadSchema.safeParse(body);
    const payload = parsed.success ? (body as Record<string, unknown>) : (body as Record<string, unknown>);
    const idempotencyKey = typeof payload?.idempotency_key === "string" ? payload.idempotency_key : undefined;

    const result = await dispatchMessage(triggerSlug, payload, idempotencyKey, undefined, "default");

    if (result.skipped) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: result.reason,
      });
    }

    if (result.duplicate) {
      return NextResponse.json({
        success: true,
        job_id: result.message_log_id,
        duplicate: true,
        message: "Duplicate event ignored",
      });
    }

    return NextResponse.json({
      success: true,
      job_id: result.job_id,
      message_log_id: result.message_log_id,
      queued: result.queued,
      message: "Message queued successfully",
    });
  } catch (error) {
    if (error instanceof TriggerNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: "TRIGGER_NOT_FOUND",
          message: error.message,
        },
        { status: 404 }
      );
    }
    if (error instanceof RecipientNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: "RECIPIENT_NOT_FOUND",
          message: error.message,
        },
        { status: 400 }
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Inbound error:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
