import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ triggerId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { triggerId } = await context.params;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date") ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const endDate = searchParams.get("end_date") ?? new Date().toISOString().slice(0, 10);

    const { data: trigger } = await supabase
      .from("triggers")
      .select("id, slug, name")
      .eq("id", triggerId)
      .single();

    if (!trigger) {
      return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const start = `${startDate}T00:00:00.000Z`;
    const end = `${endDate}T23:59:59.999Z`;

    const { data: logs } = await supabase
      .from("message_logs")
      .select("status, error_code")
      .eq("trigger_id", triggerId)
      .gte("created_at", start)
      .lte("created_at", end);

    const funnel = { sent: 0, delivered: 0, read: 0, failed: 0, queued: 0, undelivered: 0 };
    const errors: Record<string, number> = {};

    for (const log of logs ?? []) {
      if (log.status === "sent") funnel.sent++;
      else if (log.status === "delivered") funnel.delivered++;
      else if (log.status === "read") funnel.read++;
      else if (log.status === "failed" || log.status === "undelivered") {
        funnel.failed++;
        const code = log.error_code ?? "unknown";
        errors[code] = (errors[code] ?? 0) + 1;
      } else funnel.queued++;
    }

    const total = funnel.sent + funnel.delivered + funnel.read + funnel.failed + funnel.queued;
    const rates = {
      delivery_rate: total > 0 ? funnel.delivered / total : 0,
      read_rate: total > 0 ? funnel.read / total : 0,
      failure_rate: total > 0 ? funnel.failed / total : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        trigger_id: triggerId,
        trigger_name: trigger.name,
        date_range: { start: startDate, end: endDate },
        funnel,
        rates,
        errors,
      },
    });
  } catch (err) {
    console.error("Analytics funnel error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
