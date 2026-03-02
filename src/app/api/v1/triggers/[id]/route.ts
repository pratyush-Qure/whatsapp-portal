import { NextRequest, NextResponse } from "next/server";
import _get from "lodash/get";
import { createClient } from "@/lib/supabase/server";
import { createTriggerSchema } from "@/lib/utils/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await context.params;

    const { data, error } = await supabase
      .from("triggers")
      .select(`
        *,
        projects (slug),
        templates (id, name, body, category)
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const proj = Array.isArray(data.projects) ? data.projects[0] : data.projects;
    const projectSlug = _get(proj, "slug", "default") as string;
    const baseUrl = _get(process.env, "NEXT_PUBLIC_APP_URL", "http://localhost:3000") as string;
    return NextResponse.json({
      success: true,
      data: {
        ...data,
        webhook_url: `${baseUrl}/api/v1/inbound/${projectSlug}/${data.slug}`,
      },
    });
  } catch (err) {
    console.error("Trigger GET error:", err);
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

    const parsed = createTriggerSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.slug != null) updateData.slug = parsed.data.slug;
    if (parsed.data.name != null) updateData.name = parsed.data.name;
    if (parsed.data.source_type != null) updateData.source_type = parsed.data.source_type;
    if (parsed.data.template_id != null) updateData.template_id = parsed.data.template_id;
    if (parsed.data.recipient_path != null) updateData.recipient_path = parsed.data.recipient_path;
    if (parsed.data.config_json != null) updateData.config_json = parsed.data.config_json;
    if (parsed.data.conditions_json != null) updateData.conditions_json = parsed.data.conditions_json;
    if (parsed.data.status != null) updateData.status = parsed.data.status;

    const { data, error } = await supabase
      .from("triggers")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Trigger PUT error:", err);
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

    const { error } = await supabase.from("triggers").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Trigger DELETE error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
