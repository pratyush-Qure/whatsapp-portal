import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const addGroupSchema = z.object({ group_id: z.string().uuid() });

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    const { id: triggerId } = await context.params;
    const { data: links, error: linkError } = await supabase
      .from("trigger_groups")
      .select("group_id")
      .eq("trigger_id", triggerId);
    if (linkError) throw linkError;
    const groupIds = (links ?? []).map((r) => r.group_id);
    if (groupIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }
    const { data: groups, error: groupError } = await supabase
      .from("groups")
      .select("id, name, slug, project_id")
      .in("id", groupIds);
    if (groupError) throw groupError;
    const { data: counts } = await supabase
      .from("group_members")
      .select("group_id")
      .in("group_id", groupIds);
    const countByGroup = new Map<string, number>();
    for (const c of counts ?? []) {
      countByGroup.set(c.group_id, (countByGroup.get(c.group_id) ?? 0) + 1);
    }
    const result = (groups ?? []).map((g) => ({
      ...g,
      member_count: countByGroup.get(g.id) ?? 0,
    }));
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("Trigger groups GET error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    const { id: triggerId } = await context.params;
    const body = await request.json();
    const parsed = addGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const { error } = await supabase
      .from("trigger_groups")
      .insert({ trigger_id: triggerId, group_id: parsed.data.group_id });
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { success: false, error: "ALREADY_LINKED", message: "Trigger already linked to this group" },
          { status: 409 }
        );
      }
      if (error.code === "23503") {
        return NextResponse.json({ success: false, error: "NOT_FOUND", message: "Group or trigger not found" }, { status: 404 });
      }
      throw error;
    }
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("Trigger groups POST error:", err);
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
    const { id: triggerId } = await context.params;
    const groupId = request.nextUrl.searchParams.get("group_id");
    if (!groupId) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "group_id query required" },
        { status: 400 }
      );
    }
    const { error } = await supabase
      .from("trigger_groups")
      .delete()
      .eq("trigger_id", triggerId)
      .eq("group_id", groupId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Trigger groups DELETE error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
