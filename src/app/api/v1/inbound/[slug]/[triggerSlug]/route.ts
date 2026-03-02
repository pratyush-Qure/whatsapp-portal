import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchMessage, TriggerNotFoundError, RecipientNotFoundError, TemplateNotApprovedError } from "@/lib/engine/dispatcher";
import { MissingVariableError, VariableValidationError } from "@/lib/engine/resolver";

type Context = { params: Promise<{ slug: string; triggerSlug: string }> };

const HTTP_GET = "GET";
const HTTP_POST = "POST";

/** Allowed HTTP method for trigger: from config_json.http_method; default POST */
function getAllowedMethod(configJson: Record<string, unknown> | null): string | "both" {
  const method = configJson && typeof configJson.http_method === "string"
    ? (configJson.http_method as string).toUpperCase()
    : null;
  if (method === HTTP_GET || method === "GET") return HTTP_GET;
  if (method === HTTP_POST || method === "POST") return HTTP_POST;
  return HTTP_POST; // default POST
}

/** Fetch trigger config (and project id) by project slug + trigger slug */
async function getTriggerConfig(projectSlug: string, triggerSlug: string) {
  const supabase = createAdminClient();
  const { data: proj } = await supabase.from("projects").select("id").eq("slug", projectSlug).maybeSingle();
  if (!proj?.id) return null;
  const { data: trigger } = await supabase
    .from("triggers")
    .select("id, config_json")
    .eq("project_id", proj.id)
    .eq("slug", triggerSlug)
    .maybeSingle();
  return trigger;
}

export async function GET(request: Request, context: Context) {
  try {
    const { slug: projectSlug, triggerSlug } = await context.params;
    const triggerConfig = await getTriggerConfig(projectSlug, triggerSlug);
    if (!triggerConfig) {
      return NextResponse.json(
        { success: false, error: "TRIGGER_NOT_FOUND", message: "Trigger not found" },
        { status: 404 }
      );
    }
    const allowed = getAllowedMethod((triggerConfig.config_json as Record<string, unknown>) ?? null);
    if (allowed !== "both" && allowed !== HTTP_GET) {
      return NextResponse.json(
        { success: false, error: "METHOD_NOT_ALLOWED", message: "This trigger is configured for POST only" },
        { status: 405 }
      );
    }
    const url = new URL(request.url);
    const payload: Record<string, unknown> = {};
    url.searchParams.forEach((value, key) => {
      if (key.toLowerCase() !== "key") payload[key] = value;
    });
    const idempotencyKey = typeof payload?.idempotency_key === "string" ? payload.idempotency_key : undefined;

    const result = await dispatchMessage(triggerSlug, payload, idempotencyKey, undefined, projectSlug);

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
        { success: false, error: "TRIGGER_NOT_FOUND", message: error.message },
        { status: 404 }
      );
    }
    if (error instanceof RecipientNotFoundError) {
      return NextResponse.json(
        { success: false, error: "RECIPIENT_NOT_FOUND", message: error.message },
        { status: 400 }
      );
    }
    if (error instanceof TemplateNotApprovedError) {
      return NextResponse.json(
        { success: false, error: "TEMPLATE_NOT_APPROVED", message: error.message, twilio_status: error.twilioStatus },
        { status: 400 }
      );
    }
    if (error instanceof MissingVariableError) {
      return NextResponse.json(
        {
          success: false,
          error: "MISSING_VARIABLE",
          message: error.message,
          missing_path: error.payloadPath,
          variable_name: error.variableName,
        },
        { status: 400 }
      );
    }
    if (error instanceof VariableValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: "MISSING_VARIABLES",
          message: error.message,
          missing_keys: error.missing,
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
    console.error("Inbound GET error:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: Context) {
  const { slug: projectSlug, triggerSlug } = await context.params;
  const triggerConfig = await getTriggerConfig(projectSlug, triggerSlug);
  if (!triggerConfig) {
    return NextResponse.json(
      { success: false, error: "TRIGGER_NOT_FOUND", message: "Trigger not found" },
      { status: 404 }
    );
  }
  const allowed = getAllowedMethod((triggerConfig.config_json as Record<string, unknown>) ?? null);
  if (allowed === HTTP_GET) {
    return NextResponse.json(
      { success: false, error: "METHOD_NOT_ALLOWED", message: "This trigger is configured for GET only" },
      { status: 405 }
    );
  }

  const rawBody = await request.text();
  const body = JSON.parse(rawBody || "{}") as unknown;
  const payload = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const idempotencyKey = typeof payload?.idempotency_key === "string" ? payload.idempotency_key : null;

  const supabase = createAdminClient();
  const { error } = await supabase.from("inbound_webhook_queue").insert({
    project_slug: projectSlug,
    trigger_slug: triggerSlug,
    kind: "single",
    payload,
    idempotency_key: idempotencyKey || null,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ success: true, queued: true, message: "Duplicate idempotency key; already queued" });
    }
    console.error("Inbound queue insert error:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to queue webhook" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, queued: true, message: "Webhook received; processing asynchronously" });
}
