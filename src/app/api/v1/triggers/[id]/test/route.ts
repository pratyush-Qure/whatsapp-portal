import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluateConditions } from "@/lib/engine/conditions";
import { resolveTemplateVariables } from "@/lib/engine/resolver";
import { getValueByPath } from "@/lib/utils/jsonpath";
import { formatPhoneNumber } from "@/lib/utils/phone";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await context.params;
    const payload = (await request.json()) as Record<string, unknown>;

    const { data: trigger, error: triggerError } = await supabase
      .from("triggers")
      .select(`
        id,
        slug,
        template_id,
        recipient_path,
        conditions_json
      `)
      .eq("id", id)
      .single();

    if (triggerError || !trigger) {
      return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (trigger.conditions_json) {
      const passed = evaluateConditions(payload, trigger.conditions_json as Parameters<typeof evaluateConditions>[1]);
      if (!passed) {
        return NextResponse.json({
          success: true,
          dry_run: true,
          conditions_passed: false,
          message: "Conditions not met - message would be skipped",
        });
      }
    }

    const recipientRaw = getValueByPath(payload, trigger.recipient_path);
    const recipientPhone = formatPhoneNumber(recipientRaw);

    if (!recipientPhone) {
      return NextResponse.json({
        success: false,
        error: "RECIPIENT_NOT_FOUND",
        message: `No phone found at path: ${trigger.recipient_path}`,
      }, { status: 400 });
    }

    const { data: template } = await supabase
      .from("templates")
      .select("id, body")
      .eq("id", trigger.template_id)
      .single();

    if (!template) {
      return NextResponse.json({ success: false, error: "TEMPLATE_NOT_FOUND" }, { status: 404 });
    }

    const { data: variables } = await supabase
      .from("template_variables")
      .select("*")
      .eq("template_id", template.id)
      .order("position");

    const resolvedVariables = await resolveTemplateVariables(
      template,
      (variables ?? []) as Parameters<typeof resolveTemplateVariables>[1],
      payload
    );

    const { interpolateTemplate } = await import("@/lib/engine/resolver");
    const body = interpolateTemplate(template.body, resolvedVariables);

    return NextResponse.json({
      success: true,
      dry_run: true,
      conditions_passed: true,
      recipient_phone: recipientPhone,
      resolved_variables: resolvedVariables,
      preview_body: body,
    });
  } catch (err) {
    console.error("Trigger test error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
