import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const addMemberSchema = z.object({
  phone: z.string().min(1),
  name: z.string().max(100).optional(),
});
const addMembersSchema = z.object({
  members: z.array(z.object({ phone: z.string().min(1), name: z.string().max(100).optional() })).min(1).max(500),
});

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    const { id: groupId } = await context.params;
    const { data, error } = await supabase
      .from("group_members")
      .select("id, phone, name, created_at")
      .eq("group_id", groupId)
      .order("created_at");
    if (error) throw error;
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    console.error("Group members GET error:", err);
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
    const { id: groupId } = await context.params;
    const body = await request.json();
    const single = addMemberSchema.safeParse(body);
    const bulk = addMembersSchema.safeParse(body);
    if (single.success) {
      const { data, error } = await supabase
        .from("group_members")
        .insert({ group_id: groupId, phone: single.data.phone.trim(), name: single.data.name?.trim() || null })
        .select()
        .single();
      if (error) {
        if (error.code === "23505") {
          return NextResponse.json(
            { success: false, error: "DUPLICATE", message: "Phone already in group" },
            { status: 409 }
          );
        }
        throw error;
      }
      return NextResponse.json({ success: true, data }, { status: 201 });
    }
    if (bulk.success) {
      const rows = bulk.data.members.map((m) => ({
        group_id: groupId,
        phone: m.phone.trim(),
        name: m.name?.trim() || null,
      }));
      const inserted: { id: string; phone: string; name: string | null }[] = [];
      for (const row of rows) {
        const { data: one, error: insertErr } = await supabase
          .from("group_members")
          .insert(row)
          .select("id, phone, name")
          .single();
        if (!insertErr && one) inserted.push(one);
      }
      return NextResponse.json({ success: true, data: inserted, added: inserted.length }, { status: 201 });
    }
    return NextResponse.json(
      { success: false, error: "VALIDATION_ERROR", message: "Provide phone (+ name) or members array" },
      { status: 400 }
    );
  } catch (err) {
    console.error("Group members POST error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
