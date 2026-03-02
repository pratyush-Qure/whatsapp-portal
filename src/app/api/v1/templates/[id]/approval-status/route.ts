import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchApprovalStatus, isValidContentSid } from "@/lib/twilio/content";

type Context = { params: Promise<{ id: string }> };

/**
 * Fetch template approval status from Twilio/Meta and update the template in Supabase.
 * Call this to sync pending/rejected status (e.g. after Meta reviews).
 */
export async function GET(request: NextRequest, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await context.params;

    const { data: template, error: templateError } = await supabase
      .from("templates")
      .select("id, project_id, twilio_content_sid")
      .eq("id", id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const contentSid = (template as { twilio_content_sid?: string | null }).twilio_content_sid;
    if (!contentSid || !isValidContentSid(contentSid)) {
      return NextResponse.json(
        {
          success: false,
          error: contentSid ? "INVALID_CONTENT_SID" : "NOT_SUBMITTED",
          message: contentSid
            ? "Invalid content SID format. Submit the template again."
            : "Template has not been submitted to Meta. Submit it first.",
        },
        { status: 400 }
      );
    }

    const { status, rejection_reason } = await fetchApprovalStatus(contentSid, {
      project_id: template.project_id as string,
    });

    const admin = createAdminClient();
    const dbStatus = status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending";
    const { error: updateError } = await admin
      .from("templates")
      .update({
        twilio_status: dbStatus,
        twilio_rejected_reason: rejection_reason ?? null,
      })
      .eq("id", id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      data: {
        twilio_status: dbStatus,
        rejection_reason: rejection_reason ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch approval status";
    console.error("Approval status fetch error:", err);
    return NextResponse.json(
      { success: false, error: "FETCH_FAILED", message },
      { status: 502 }
    );
  }
}
