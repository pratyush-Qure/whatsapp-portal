import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * List opt-outs for a project (users who replied STOP or were added manually).
 * Required for compliance (DPDP, GDPR) — never send to these numbers.
 */
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
    const projectId = searchParams.get("project_id");
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "project_id is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("opt_outs")
      .select("id, phone, opted_out_at, source, created_at")
      .eq("project_id", projectId)
      .order("opted_out_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data ?? [],
    });
  } catch (err) {
    console.error("Opt-outs GET error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
