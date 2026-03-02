import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTwilioMessageLogs } from "@/lib/twilio/logs";

/**
 * GET /api/v1/logs/twilio — fetch message list from Twilio API.
 * Only works when MESSAGING_PROVIDER=twilio.
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
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    const dateSentAfter = searchParams.get("dateSentAfter");
    const after = dateSentAfter ? new Date(dateSentAfter) : undefined;

    const result = await getTwilioMessageLogs({ limit, dateSentAfter: after });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error.includes("not the configured provider") ? 400 : 502 }
      );
    }

    return NextResponse.json({ success: true, data: result.messages });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch Twilio logs";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
