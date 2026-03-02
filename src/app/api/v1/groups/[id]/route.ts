import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateGroupSchema } from "@/lib/utils/validation";

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
      .from("groups")
      .select("id, name, slug, description, project_id, default_trigger_id, created_at")
      .eq("id", id)
      .single();
    if (error || !data) {
      return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Group GET error:", err);
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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const parsed = updateGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", details: parsed.error.issues },
        { status: 400 }
      );
    }
    if (parsed.data.default_trigger_id !== undefined) {
      const tid = parsed.data.default_trigger_id;
      if (tid) {
        const { data: group } = await supabase.from("groups").select("project_id").eq("id", id).single();
        if (group) {
          const { data: trigger } = await supabase
            .from("triggers")
            .select("id")
            .eq("id", tid)
            .eq("project_id", group.project_id)
            .maybeSingle();
          if (!trigger) {
            return NextResponse.json(
              { success: false, error: "TRIGGER_NOT_FOUND", message: "Trigger not found or not in this project." },
              { status: 400 }
            );
          }
          const { error: linkErr } = await supabase
            .from("trigger_groups")
            .insert({ trigger_id: tid, group_id: id });
          if (linkErr && linkErr.code !== "23505") {
            console.error("Trigger group link error:", linkErr);
          }
        }
      }
    }
    const updateData: Record<string, unknown> = {};
    if (parsed.data.name != null) updateData.name = parsed.data.name;
    if (parsed.data.slug != null) updateData.slug = parsed.data.slug;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.default_trigger_id !== undefined) updateData.default_trigger_id = parsed.data.default_trigger_id;
    if (Object.keys(updateData).length === 0) {
      const { data } = await supabase.from("groups").select("*").eq("id", id).single();
      return NextResponse.json({ success: true, data });
    }
    const { data, error } = await supabase
      .from("groups")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Group PUT error:", err);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message },
      { status: 500 }
    );
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
    const { error } = await supabase.from("groups").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Group DELETE error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
