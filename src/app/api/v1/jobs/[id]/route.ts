import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
      .from("job_queue")
      .select(`
        *,
        triggers (slug, name),
        message_logs (recipient_phone, status, resolved_params)
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Job GET error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
