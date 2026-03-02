import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json();
    if (!body.event_name) {
      return NextResponse.json({ success: false, error: "event_name is required" }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: { id: crypto.randomUUID() } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to track event";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
