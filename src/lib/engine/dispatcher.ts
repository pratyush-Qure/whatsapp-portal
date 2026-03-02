import _get from "lodash/get";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValueByPath } from "@/lib/utils/jsonpath";
import { formatPhoneNumber } from "@/lib/utils/phone";
import { evaluateConditions, type RuleTree } from "./conditions";
import { resolveTemplateVariables, interpolateTemplate, validatePayloadVariables, VariableValidationError } from "./resolver";
import { enqueueMessageJob } from "@/lib/queue/pg-cron";

export class TriggerNotFoundError extends Error {
  constructor(public slug: string) {
    super(`Trigger not found: ${slug}`);
    this.name = "TriggerNotFoundError";
  }
}

export class RecipientNotFoundError extends Error {
  constructor(public path: string) {
    super(`Recipient phone not found at path: ${path}`);
    this.name = "RecipientNotFoundError";
  }
}

export class TemplateNotApprovedError extends Error {
  constructor(
    public templateId: string,
    public twilioStatus: string,
    message?: string
  ) {
    super(
      message ??
        `Template is not approved for sending (status: ${twilioStatus}). Submit for approval and wait until Meta approves.`
    );
    this.name = "TemplateNotApprovedError";
  }
}

export type DispatchResult = {
  success: boolean;
  job_id?: string;
  message_log_id?: string;
  queued?: boolean;
  duplicate?: boolean;
  skipped?: boolean;
  reason?: string;
};

export type DispatchOptions = {
  /** Allow dispatching for draft/paused triggers (e.g. manual send from UI) */
  allowDraft?: boolean;
  /** When to send (ISO string). Omit to send immediately. */
  scheduledFor?: string;
};

export async function dispatchByTriggerId(
  triggerId: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
  opts?: DispatchOptions
): Promise<DispatchResult> {
  const supabase = createAdminClient();

  const { data: trigger, error: triggerError } = await supabase
    .from("triggers")
    .select("id, project_id, slug, template_id, recipient_path, conditions_json, status")
    .eq("id", triggerId)
    .maybeSingle();

  if (triggerError || !trigger) {
    throw new TriggerNotFoundError(triggerId);
  }

  return dispatchFromTrigger(supabase, trigger, payload, idempotencyKey, opts);
}

export async function dispatchMessage(
  triggerSlug: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
  opts?: DispatchOptions,
  projectSlug?: string
): Promise<DispatchResult> {
  const supabase = createAdminClient();

  let projectId: string = "d0000000-0000-4000-8000-000000000001";
  if (projectSlug) {
    const { data: proj } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", projectSlug)
      .maybeSingle();
    projectId = _get(proj, "id", projectId) as string;
  }

  let query = supabase
    .from("triggers")
    .select(`
      id,
      project_id,
      slug,
      name,
      template_id,
      recipient_path,
      conditions_json,
      status
    `)
    .eq("slug", triggerSlug)
    .eq("project_id", projectId);

  if (!opts?.allowDraft) {
    query = query.eq("status", "active");
  }

  const { data: trigger, error: triggerError } = await query.maybeSingle();

  if (triggerError || !trigger) {
    throw new TriggerNotFoundError(triggerSlug);
  }

  return dispatchFromTrigger(supabase, trigger, payload, idempotencyKey, opts);
}

async function dispatchFromTrigger(
  supabase: ReturnType<typeof createAdminClient>,
  trigger: {
    id: string;
    project_id: string;
    template_id: string | null;
    recipient_path: string;
    conditions_json: unknown;
    status: string;
  },
  payload: Record<string, unknown>,
  idempotencyKey?: string,
  opts?: DispatchOptions
): Promise<DispatchResult> {
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from("message_logs")
      .select("id")
      .filter("resolved_params->>idempotency_key", "eq", idempotencyKey)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (existing) {
      return {
        success: true,
        duplicate: true,
        message_log_id: existing.id,
      };
    }
  }

  if (!trigger.template_id) {
    throw new Error("Trigger is missing template_id");
  }

  if (trigger.conditions_json) {
    const passed = evaluateConditions(payload, trigger.conditions_json as RuleTree);
    if (!passed) {
      return {
        success: true,
        skipped: true,
        reason: "conditions_not_met",
      };
    }
  }

  const recipientRaw = getValueByPath(payload, trigger.recipient_path);
  const recipientPhone = formatPhoneNumber(recipientRaw);
  if (!recipientPhone) {
    throw new RecipientNotFoundError(trigger.recipient_path);
  }

  const { data: optOut } = await supabase
    .from("opt_outs")
    .select("id")
    .eq("project_id", trigger.project_id)
    .eq("phone", recipientPhone)
    .maybeSingle();
  if (optOut) {
    return {
      success: true,
      skipped: true,
      reason: "opted_out",
    };
  }

  const { data: template } = await supabase
    .from("templates")
    .select("id, body, twilio_status, twilio_content_sid")
    .eq("id", trigger.template_id)
    .single();

  if (!template) {
    throw new Error("Template not found");
  }

  const twilioStatus = (template as { twilio_status?: string }).twilio_status ?? "draft";
  if (twilioStatus !== "approved") {
    throw new TemplateNotApprovedError(
      template.id,
      twilioStatus
    );
  }

  const { data: variables } = await supabase
    .from("template_variables")
    .select("*")
    .eq("template_id", template.id)
    .order("position");

  const variableList = (variables ?? []) as {
    position: number;
    name: string;
    type: "text" | "number" | "date" | "url" | "phone";
    source: "payload" | "static" | "computed";
    payload_path: string | null;
    static_value: string | null;
    compute_expr: string | null;
    required: boolean;
  }[];

  const validation = validatePayloadVariables(variableList, payload);
  if (!validation.valid) {
    throw new VariableValidationError(
      `Missing or empty required payload keys: ${validation.missing.map((m) => m.payload_path).join(", ")}`,
      validation.missing
    );
  }

  const resolvedVariables = await resolveTemplateVariables(
    template,
    variableList,
    payload
  );

  const resolvedParams = {
    variables: resolvedVariables,
    payload_snapshot: payload,
    idempotency_key: idempotencyKey,
  };

  const { data: messageLog, error: logError } = await supabase
    .from("message_logs")
    .insert({
      trigger_id: trigger.id,
      template_id: template.id,
      recipient_phone: recipientPhone,
      status: "queued",
      resolved_params: resolvedParams,
    })
    .select("id")
    .single();

  if (logError || !messageLog) {
    throw new Error(logError?.message ?? "Failed to create message log");
  }

  const jobId = await enqueueMessageJob(
    {
      message_log_id: messageLog.id,
      trigger_id: trigger.id,
      template_id: template.id,
      recipient_phone: recipientPhone,
      resolved_variables: resolvedVariables,
    },
    opts?.scheduledFor ? { scheduledFor: opts.scheduledFor } : undefined
  );

  return {
    success: true,
    job_id: jobId,
    message_log_id: messageLog.id,
    queued: true,
  };
}
