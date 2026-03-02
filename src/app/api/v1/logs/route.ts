import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProjectIdBySlug } from "@/lib/project";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    const projectSlug = searchParams.get("project") ?? undefined;
    const q = searchParams.get("q")?.trim() ?? "";

    let triggerIds: string[] = [];
    if (projectSlug) {
      const projectId = await getProjectIdBySlug(projectSlug);
      const { data: projectTriggers } = await supabase
        .from("triggers")
        .select("id")
        .eq("project_id", projectId);
      triggerIds = (projectTriggers ?? []).map((t) => t.id);
    }

    let query = supabase
      .from("message_logs")
      .select(
        `
        id,
        trigger_id,
        recipient_phone,
        status,
        twilio_message_sid,
        error_message,
        created_at,
        triggers (slug, name)
      `
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (projectSlug && triggerIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }
    if (triggerIds.length > 0) {
      query = query.in("trigger_id", triggerIds);
    }
    if (q) {
      query = query.or(
        `recipient_phone.ilike.%${q}%,error_message.ilike.%${q}%`
      );
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch logs";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
