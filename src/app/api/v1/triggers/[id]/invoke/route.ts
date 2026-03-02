import _set from "lodash/set";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValueByPath } from "@/lib/utils/jsonpath";
import { dispatchByTriggerId, TriggerNotFoundError, RecipientNotFoundError, TemplateNotApprovedError } from "@/lib/engine/dispatcher";
import { MissingVariableError } from "@/lib/engine/resolver";

type Context = { params: Promise<{ id: string }> };

type InvokeResult = {
  phone: string;
  job_id?: string;
  message_log_id?: string;
  skipped?: boolean;
  duplicate?: boolean;
  error?: string;
};

export async function POST(request: NextRequest, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id: triggerId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const target = (body?.target as string) || "phone";
    const recipientPath = (body?.recipient_path as string) || "phone";

    const { data: trigger, error: triggerError } = await supabase
      .from("triggers")
      .select("id, recipient_path, template_id")
      .eq("id", triggerId)
      .single();
    if (triggerError || !trigger) {
      return NextResponse.json({ success: false, error: "TRIGGER_NOT_FOUND" }, { status: 404 });
    }
    const path = (trigger.recipient_path as string) ?? "phone";

    if (target === "phone") {
      const phone = typeof body?.phone === "string" ? body.phone : (body?.[path] as string) ?? "";
      if (!phone.trim()) {
        return NextResponse.json(
          { success: false, error: "RECIPIENT_NOT_FOUND", message: "Provide phone (or value for recipient path)" },
          { status: 400 }
        );
      }
      const payload: Record<string, unknown> = typeof body === "object" && body !== null ? { ...body } : {};
      _set(payload, path, phone);
      delete (payload as Record<string, unknown>).target;
      delete (payload as Record<string, unknown>).group_id;

      const result = await dispatchByTriggerId(triggerId, payload, undefined, { allowDraft: true });
      if (result.skipped) {
        return NextResponse.json({ success: true, skipped: true, reason: result.reason });
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
        message: "Trigger invoked; message queued",
      });
    }

    if (target === "groups" || target === "all") {
      const { data: links } = await supabase
        .from("trigger_groups")
        .select("group_id")
        .eq("trigger_id", triggerId);
      const linkedGroupIds = (links ?? []).map((r) => r.group_id);

      let groupIds: string[] = [];
      if (target === "groups") {
        const raw = body?.group_ids;
        const ids = Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
        if (ids.length === 0) {
          return NextResponse.json(
            { success: false, error: "VALIDATION_ERROR", message: "Select at least one group (group_ids array)" },
            { status: 400 }
          );
        }
        const invalid = ids.filter((id) => !linkedGroupIds.includes(id));
        if (invalid.length > 0) {
          return NextResponse.json(
            { success: false, error: "GROUP_NOT_LINKED", message: "Some groups are not linked to this trigger" },
            { status: 400 }
          );
        }
        groupIds = [...new Set(ids)];
      } else {
        groupIds = linkedGroupIds;
        if (groupIds.length === 0) {
          return NextResponse.json(
            { success: false, error: "NO_GROUPS", message: "No groups linked to this trigger" },
            { status: 400 }
          );
        }
      }

      const { data: members } = await supabase
        .from("group_members")
        .select("phone, name")
        .in("group_id", groupIds);
      const byPhone = new Map<string, { phone: string; name: string | null }>();
      for (const m of members ?? []) {
        const p = m.phone?.trim();
        if (p && !byPhone.has(p)) byPhone.set(p, { phone: p, name: m.name ?? null });
      }
      const memberList = Array.from(byPhone.values());
      if (memberList.length === 0) {
        return NextResponse.json(
          { success: false, error: "NO_MEMBERS", message: "Selected group(s) have no members" },
          { status: 400 }
        );
      }

      const basePayload: Record<string, unknown> = typeof body === "object" && body !== null ? { ...body } : {};
      delete basePayload.target;
      delete basePayload.group_id;
      delete basePayload.group_ids;
      delete basePayload.phone;

      if (trigger.template_id) {
        const { data: vars } = await supabase
          .from("template_variables")
          .select("payload_path, name, required")
          .eq("template_id", trigger.template_id)
          .eq("source", "payload")
          .eq("required", true);
        const requiredPaths = (vars ?? [])
          .map((v) => (v.payload_path as string)?.trim())
          .filter(Boolean)
          .filter((p) => p !== path && p !== "name");
        const missing = requiredPaths.filter((p) => {
          const v = getValueByPath(basePayload, p);
          return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
        });
        if (missing.length > 0) {
          return NextResponse.json(
            {
              success: false,
              error: "MISSING_VARIABLES",
              message: "Template requires variables that are not in the request body. Add them for all recipients or use the webhook for per-recipient values.",
              missing_keys: missing,
            },
            { status: 400 }
          );
        }
      }

      const results: InvokeResult[] = [];
      for (const member of memberList) {
        const payload = { ...basePayload };
        _set(payload, path, member.phone);
        if (member.name != null && member.name !== "") _set(payload, "name", member.name);
        try {
          const result = await dispatchByTriggerId(triggerId, payload, undefined, { allowDraft: true });
          if (result.skipped) {
            results.push({ phone: member.phone, skipped: true });
          } else if (result.duplicate) {
            results.push({ phone: member.phone, duplicate: true, message_log_id: result.message_log_id });
          } else {
            results.push({
              phone: member.phone,
              job_id: result.job_id,
              message_log_id: result.message_log_id,
            });
          }
        } catch (err) {
          const msg =
            err instanceof MissingVariableError
              ? `Missing variable: ${err.payloadPath ?? err.variableName}`
              : err instanceof RecipientNotFoundError
                ? "Invalid phone"
                : err instanceof Error
                  ? err.message
                  : "Failed";
          results.push({ phone: member.phone, error: msg });
        }
      }

      const succeeded = results.filter((r) => !r.error && !r.skipped).length + results.filter((r) => r.duplicate).length;
      return NextResponse.json({
        success: true,
        data: { results, summary: { total: memberList.length, succeeded, failed: results.filter((r) => r.error).length } },
        message: `Invoked for ${succeeded} recipient(s)`,
      });
    }

    return NextResponse.json(
      { success: false, error: "VALIDATION_ERROR", message: "target must be phone, groups, or all" },
      { status: 400 }
    );
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
    console.error("Trigger invoke error:", error);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
