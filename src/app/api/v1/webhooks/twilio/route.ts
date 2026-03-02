import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPhoneNumber } from "@/lib/utils/phone";

const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "cancel", "end", "quit"];

function isOptOut(body: string): boolean {
  const normalized = body.trim().toLowerCase();
  return OPT_OUT_KEYWORDS.includes(normalized) || normalized === "stop";
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const body = Object.fromEntries(formData) as Record<string, string>;

    const signature = request.headers.get("x-twilio-signature") ?? "";
    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/webhooks/twilio`;

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const isValid = twilio.validateRequest(authToken, signature, url, body);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const supabase = createAdminClient();

    // Status callback (outbound message delivery status) — has MessageSid + MessageStatus
    const messageSid = body.MessageSid;
    const messageStatus = body.MessageStatus;
    const errorCode = body.ErrorCode ?? null;
    const errorMessage = body.ErrorMessage ?? null;

    if (messageSid && messageStatus) {
      const updateData: Record<string, unknown> = {
        status: messageStatus.toLowerCase(),
        updated_at: new Date().toISOString(),
      };
      if (messageStatus === "sent") {
        updateData.sent_at = new Date().toISOString();
      } else if (messageStatus === "delivered") {
        updateData.delivered_at = new Date().toISOString();
      } else if (messageStatus === "read") {
        updateData.read_at = new Date().toISOString();
      } else if (messageStatus === "failed" || messageStatus === "undelivered") {
        updateData.failed_at = new Date().toISOString();
        updateData.error_code = errorCode;
        updateData.error_message = errorMessage;
      }
      const { error } = await supabase
        .from("message_logs")
        .update(updateData)
        .eq("twilio_message_sid", messageSid);

      if (error) {
        console.error("Failed to update message log:", error);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // Inbound message (user sent us a message): check for STOP and add to opt-out list
    const inboundBody = body.Body;
    const from = body.From;
    const to = body.To;
    if (typeof inboundBody === "string" && from && to && isOptOut(inboundBody)) {
      const fromPhone = formatPhoneNumber((from as string).replace(/^whatsapp:/i, "").trim());
      const projectId = process.env.MESSAGING_PROJECT_ID?.trim();
      if (fromPhone && projectId) {
        await supabase.from("opt_outs").upsert(
          {
            project_id: projectId,
            phone: fromPhone,
            opted_out_at: new Date().toISOString(),
            source: "inbound",
          },
          { onConflict: "project_id,phone" }
        );
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Twilio webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
