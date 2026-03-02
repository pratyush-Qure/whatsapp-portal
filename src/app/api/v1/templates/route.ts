import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTemplateSchema } from "@/lib/utils/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    const offset = page * limit;

    let query = supabase
      .from("templates")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && ["draft", "pending", "approved", "rejected"].includes(status)) {
      query = query.eq("twilio_status", status);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data ?? [],
      pagination: { page, limit, total: count ?? 0 },
    });
  } catch (err) {
    console.error("Templates GET error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const { data: template, error } = await supabase
      .from("templates")
      .insert({
        project_id: data.project_id,
        name: data.name,
        category: data.category,
        language: data.language,
        header_type: data.header_type ?? "none",
        header_content: data.header_content ?? null,
        body: data.body,
        footer: data.footer ?? null,
        buttons_json: data.buttons_json ?? [],
      })
      .select()
      .single();

    if (error) throw error;

    if (data.variables && data.variables.length > 0) {
      await supabase.from("template_variables").insert(
        data.variables.map((v) => ({
          template_id: template.id,
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
      .eq("template_id", template.id)
      .order("position");

    return NextResponse.json(
      {
        success: true,
        data: { ...template, variables: variables ?? [] },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Templates POST error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
