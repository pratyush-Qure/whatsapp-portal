import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProviderEnvInfo } from "@/lib/messaging-provider";

/**
 * Messaging provider is configured via MESSAGING_PROVIDER and provider-specific env vars.
 * This API returns a read-only view for display in Settings.
 */

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const info = getProviderEnvInfo();

    if (!info.configured) {
      return NextResponse.json({
        success: true,
        data: [],
        message: `Set MESSAGING_PROVIDER and ${info.accountLabel}, plus provider-specific credentials in .env`,
      });
    }

    const data = [
      {
        id: null as string | null,
        name: `Default (${info.displayName} from environment)`,
        account_sid: info.accountValue,
        phone_number: info.phoneValue,
        is_active: true,
        rate_limit_per_sec: 80,
        created_at: null as string | null,
      },
    ];

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Twilio accounts GET error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: "NOT_SUPPORTED",
      message: "Messaging is configured via MESSAGING_PROVIDER and provider-specific env vars only.",
    },
    { status: 405 }
  );
}
