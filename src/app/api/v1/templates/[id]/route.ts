import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTemplateSchema } from "@/lib/utils/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await context.params;

    const { data: template, error } = await supabase
      .from("templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !template) {
      return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const { data: variables } = await supabase
      .from("template_variables")
      .select("*")
      .eq("template_id", id)
      .order("position");

    return NextResponse.json({
      success: true,
      data: { ...template, variables: variables ?? [] },
    });
  } catch (err) {
    console.error("Template GET error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const parsed = createTemplateSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { data: existingTemplate, error: fetchExistingError } = await supabase
      .from("templates")
      .select("id, name, category, language, header_type, header_content, body, footer, buttons_json, twilio_status")
      .eq("id", id)
      .single();

    if (fetchExistingError || !existingTemplate) {
      return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    let contentChanged = false;

    const markChanged = (nextValue: unknown, currentValue: unknown) => {
      if (JSON.stringify(nextValue) !== JSON.stringify(currentValue)) {
        contentChanged = true;
      }
    };

    if (parsed.data.name != null) updateData.name = parsed.data.name;
    if (parsed.data.category != null) updateData.category = parsed.data.category;
    if (parsed.data.language != null) updateData.language = parsed.data.language;
    if (parsed.data.header_type != null) updateData.header_type = parsed.data.header_type;
    if (parsed.data.header_content != null) updateData.header_content = parsed.data.header_content;
    if (parsed.data.body != null) updateData.body = parsed.data.body;
    if (parsed.data.footer != null) updateData.footer = parsed.data.footer;
    if (parsed.data.buttons_json != null) updateData.buttons_json = parsed.data.buttons_json;

    if (parsed.data.name != null) markChanged(parsed.data.name, existingTemplate.name);
    if (parsed.data.category != null) markChanged(parsed.data.category, existingTemplate.category);
    if (parsed.data.language != null) markChanged(parsed.data.language, existingTemplate.language);
    if (parsed.data.header_type != null) markChanged(parsed.data.header_type, existingTemplate.header_type);
    if (parsed.data.header_content != null) markChanged(parsed.data.header_content, existingTemplate.header_content);
    if (parsed.data.body != null) markChanged(parsed.data.body, existingTemplate.body);
    if (parsed.data.footer != null) markChanged(parsed.data.footer, existingTemplate.footer);
    if (parsed.data.buttons_json != null) markChanged(parsed.data.buttons_json, existingTemplate.buttons_json);
    if (parsed.data.variables != null) contentChanged = true;

    const currentStatus = (existingTemplate.twilio_status ?? "draft").toLowerCase();
    if (contentChanged && (currentStatus === "approved" || currentStatus === "pending")) {
      updateData.twilio_status = "draft";
      updateData.twilio_content_sid = null;
      updateData.twilio_rejected_reason = null;
    }

    const { data, error } = await supabase
      .from("templates")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (parsed.data.variables && parsed.data.variables.length > 0) {
      await supabase.from("template_variables").delete().eq("template_id", id);
      await supabase.from("template_variables").insert(
        parsed.data.variables.map((v) => ({
          template_id: id,
          position: v.position,
          name: v.name,
          type: v.type,
          source: v.source,
          payload_path: v.payload_path ?? null,
          static_value: v.static_value ?? null,
          compute_expr: v.compute_expr ?? null,
          required: v.required,
        }))
      );
    }

    const { data: variables } = await supabase
      .from("template_variables")
      .select("*")
      .eq("template_id", id)
      .order("position");

    return NextResponse.json({
      success: true,
      data: { ...data, variables: variables ?? [] },
    });
  } catch (err) {
    console.error("Template PUT error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await context.params;

    const { data: template, error: fetchError } = await supabase
      .from("templates")
      .select("id, name, twilio_status, twilio_content_sid")
      .eq("id", id)
      .single();

    if (fetchError || !template) {
      return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const status = (template as { twilio_status?: string }).twilio_status ?? "draft";
    const allowedStatuses = ["draft", "rejected"];
    if (!allowedStatuses.includes(status.toLowerCase())) {
      return NextResponse.json(
        {
          success: false,
          error: "DELETE_NOT_ALLOWED",
          message: "Only draft or rejected templates can be deleted. Approved or pending templates cannot be removed.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("templates").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      warning:
        "Per Meta policy, this template name cannot be reused for 30 days. Use a different name if you create a new template.",
    });
  } catch (err) {
    console.error("Template DELETE error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
