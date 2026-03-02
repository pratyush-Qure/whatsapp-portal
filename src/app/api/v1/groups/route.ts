import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createGroupSchema } from "@/lib/utils/validation";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    const projectId = request.nextUrl.searchParams.get("project_id");
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "project_id required" },
        { status: 400 }
      );
    }
    const { data, error } = await supabase
      .from("groups")
      .select("id, name, slug, description, project_id, default_trigger_id, created_at")
      .eq("project_id", projectId)
      .order("name");
    if (error) throw error;
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof (err as { message?: string })?.message === "string"
          ? (err as { message: string }).message
          : String(err);
    console.error("Groups GET error:", err);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const parsed = createGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", details: parsed.error.issues },
        { status: 400 }
      );
    }
    let slug =
      parsed.data.slug?.trim() ||
      parsed.data.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "");
    if (!slug) {
      slug = `group_${Date.now()}`;
    }
    const defaultTriggerId = parsed.data.default_trigger_id ?? null;
    if (defaultTriggerId) {
      const { data: trigger } = await supabase
        .from("triggers")
        .select("id")
        .eq("id", defaultTriggerId)
        .eq("project_id", parsed.data.project_id)
        .maybeSingle();
      if (!trigger) {
        return NextResponse.json(
          { success: false, error: "TRIGGER_NOT_FOUND", message: "Trigger not found or not in this project." },
          { status: 400 }
        );
      }
    }
    const { data, error } = await supabase
      .from("groups")
      .insert({
        project_id: parsed.data.project_id,
        name: parsed.data.name.trim(),
        slug,
        description: parsed.data.description?.trim() || null,
        default_trigger_id: defaultTriggerId,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { success: false, error: "SLUG_EXISTS", message: "Group slug already exists in project" },
          { status: 409 }
        );
      }
      if (error.code === "23503") {
        return NextResponse.json(
          { success: false, error: "PROJECT_NOT_FOUND", message: "Project not found. Check that you're in a valid project." },
          { status: 400 }
        );
      }
      console.error("Groups POST insert error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "INTERNAL_ERROR",
          message: error.message ?? "Database error",
          code: error.code,
          details: error.details,
        },
        { status: 500 }
      );
    }
    if (defaultTriggerId && data) {
      const { error: linkErr } = await supabase
        .from("trigger_groups")
        .insert({ trigger_id: defaultTriggerId, group_id: data.id });
      if (linkErr && linkErr.code !== "23505") {
        console.error("Trigger group link error:", linkErr);
      }
    }
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    const raw = err as { message?: string; code?: string; details?: string } | null | undefined;
    const message =
      err instanceof Error
        ? err.message
        : raw && typeof raw.message === "string"
          ? raw.message
          : raw && typeof raw === "object"
            ? JSON.stringify(raw)
            : String(err ?? "Unknown error");
    console.error("Groups POST error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: message || "Unknown error",
        ...(raw && typeof raw.code === "string" && { code: raw.code }),
      },
      { status: 500 }
    );
  }
}
