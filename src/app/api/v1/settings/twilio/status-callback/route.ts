import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncPhoneNumberStatusCallback } from "@/lib/twilio";

/**
 * Sync Twilio phone number's Status Callback URL from this project's NEXT_PUBLIC_APP_URL.
 * - Public URL → set to {appUrl}/api/v1/webhooks/twilio
 * - Localhost or empty → clear (avoids error 21609)
 * Requires auth.
 */
export async function PUT() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await syncPhoneNumberStatusCallback();
    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          statusCallback: result.statusCallback,
          message: result.message,
        },
      });
    }
    return NextResponse.json(
      { success: false, error: result.error, code: result.code },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to sync status callback";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
