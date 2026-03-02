import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") ?? "7", 10)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [{ count: triggersCount }, { count: templatesCount }, { data: logs }] = await Promise.all([
      supabase.from("triggers").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("templates").select("*", { count: "exact", head: true }),
      supabase
        .from("message_logs")
        .select("status")
        .gte("created_at", since),
    ]);

    const sent = logs?.filter((l) => l.status === "sent" || l.status === "delivered" || l.status === "read").length ?? 0;
    const delivered = logs?.filter((l) => l.status === "delivered" || l.status === "read").length ?? 0;
    const failed = logs?.filter((l) => l.status === "failed" || l.status === "undelivered").length ?? 0;
    const queued = logs?.filter((l) => l.status === "queued").length ?? 0;
    const total = logs?.length ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        triggers_count: triggersCount ?? 0,
        templates_count: templatesCount ?? 0,
        messages: {
          total,
          sent,
          delivered,
          failed,
          queued,
          delivery_rate_percent: total > 0 ? Math.round((delivered / total) * 100 * 100) / 100 : 0,
        },
        period_days: days,
      },
    });
  } catch (err) {
    console.error("Analytics overview error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
