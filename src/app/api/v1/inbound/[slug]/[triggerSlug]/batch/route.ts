import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ slug: string; triggerSlug: string }> };

const MAX_BATCH_SIZE = 100;

async function getTriggerConfig(projectSlug: string, triggerSlug: string) {
  const supabase = createAdminClient();
  const { data: proj } = await supabase.from("projects").select("id").eq("slug", projectSlug).maybeSingle();
  if (!proj?.id) return null;
  const { data: trigger } = await supabase
    .from("triggers")
    .select("id")
    .eq("project_id", proj.id)
    .eq("slug", triggerSlug)
    .maybeSingle();
  return trigger;
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

  const rawBody = await request.text();
  const body = JSON.parse(rawBody || "{}") as unknown;
  if (!body || typeof body !== "object" || !Array.isArray((body as { payloads?: unknown }).payloads)) {
    return NextResponse.json(
      { success: false, error: "VALIDATION_ERROR", message: "Body must be { payloads: Array<object> }" },
      { status: 400 }
    );
  }
  const payloads = (body as { payloads: unknown[] }).payloads;
  if (payloads.length === 0) {
    return NextResponse.json(
      { success: false, error: "VALIDATION_ERROR", message: "payloads array must not be empty" },
      { status: 400 }
    );
  }
  if (payloads.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { success: false, error: "VALIDATION_ERROR", message: `payloads array must not exceed ${MAX_BATCH_SIZE} items` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("inbound_webhook_queue").insert({
    project_slug: projectSlug,
    trigger_slug: triggerSlug,
    kind: "batch",
    payload: body as Record<string, unknown>,
    idempotency_key: null,
    status: "pending",
  });

  if (error) {
    console.error("Inbound batch queue insert error:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to queue batch" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    queued: true,
    message: "Batch webhook received; processing asynchronously",
    count: payloads.length,
  });
}
