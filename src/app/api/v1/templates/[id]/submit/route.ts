import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createContentTemplate,
  submitForWhatsAppApproval,
} from "@/lib/twilio/content";

type Context = { params: Promise<{ id: string }> };

/**
 * Submit template for Meta/WhatsApp approval.
 * Creates the template in Twilio Content API and submits for WhatsApp review.
 * Template must be in draft. After success, status becomes pending until Meta approves/rejects.
 */
export async function POST(request: NextRequest, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await context.params;

    const { data: template, error: templateError } = await supabase
      .from("templates")
      .select("id, project_id, name, body, footer, category, language, twilio_status")
      .eq("id", id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const status = (template as { twilio_status?: string }).twilio_status ?? "draft";
    if (status !== "draft") {
      return NextResponse.json(
        {
          success: false,
          error: "ALREADY_SUBMITTED",
          message: `Template is already ${status}. Rejected templates must be edited and resubmitted as a new template.`,
        },
        { status: 400 }
      );
    }

    const { data: variables } = await supabase
      .from("template_variables")
      .select("position, name, payload_path")
      .eq("template_id", id)
      .order("position");

    const variableList = (variables ?? []) as { position: number; name: string; payload_path: string | null }[];
    const defaultVariables: Record<string, string> = {};
    for (const v of variableList) {
      const sample = v.payload_path ?? v.name ?? `var_${v.position}`;
      defaultVariables[String(v.position)] = sample.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
    if (Object.keys(defaultVariables).length === 0) {
      defaultVariables["1"] = "Sample";
    }

    const { sid } = await createContentTemplate(
      {
        friendly_name: (template.name as string).replace(/\s+/g, "_").toLowerCase().slice(0, 256),
        language: (template.language as string) || "en",
        body: template.body as string,
        footer: template.footer as string | null,
        category: (template.category as "utility" | "marketing" | "authentication") || "utility",
        variables: defaultVariables,
      }
    );

    await submitForWhatsAppApproval(sid, {
      name: (template.name as string).replace(/\s+/g, "_").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 256),
      category: (template.category as string) || "utility",
    });

    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from("templates")
      .update({
        twilio_status: "pending",
        twilio_content_sid: sid,
        twilio_rejected_reason: null,
      })
      .eq("id", id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      data: { content_sid: sid, twilio_status: "pending" },
      message: "Template submitted for WhatsApp approval. Check status in a few minutes.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to submit template";
    console.error("Template submit error:", err);
    return NextResponse.json(
      { success: false, error: "SUBMIT_FAILED", message },
      { status: 502 }
    );
  }
}
