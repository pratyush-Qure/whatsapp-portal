import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns messaging rate-limit awareness for the portal.
 * WhatsApp limits unique users per day (e.g. 1k/day for new numbers, scales with quality).
 * This API returns how many unique recipients we've sent to in the last 24h so the UI can warn.
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
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from("message_logs")
      .select("recipient_phone, trigger_id", { count: "exact", head: false })
      .in("status", ["sent", "delivered", "read"])
      .gte("sent_at", since);

    if (projectId) {
      const { data: triggerIds } = await supabase
        .from("triggers")
        .select("id")
        .eq("project_id", projectId);
      const ids = (triggerIds ?? []).map((r) => r.id);
      if (ids.length > 0) {
        query = query.in("trigger_id", ids);
      }
    }

    const { data: rows } = await query;
    const uniquePhones = new Set((rows ?? []).map((r) => (r as { recipient_phone: string }).recipient_phone));
    const unique_count_24h = uniquePhones.size;

    return NextResponse.json({
      success: true,
      data: {
        unique_recipients_last_24h: unique_count_24h,
        note: "WhatsApp limits unique users per day (e.g. 1k/day for new numbers; limits scale with quality). Stay under your account limit to avoid penalties.",
      },
    });
  } catch (err) {
    console.error("Rate limit API error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
