import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: {
        auth_user_id: user.id,
        email: user.email ?? undefined,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load user";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
