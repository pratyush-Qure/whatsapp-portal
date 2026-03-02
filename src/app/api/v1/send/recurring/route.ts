import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { getNextRunAtISO } from "@/lib/recurring/next-run";

const createRecurringSchema = z.object({
  triggerId: z.string().uuid(),
  projectId: z.string().uuid(),
  recipient: z.record(z.string(), z.unknown()),
  recurrence: z.object({
    type: z.enum(["daily", "weekly"]),
    timeOfDay: z.string().regex(/^\d{1,2}:\d{2}$/),
    timezone: z.string().optional(),
  }),
  endCondition: z.object({
    type: z.enum(["until_date", "after_count", "never"]),
    value: z.union([z.string(), z.number().int().positive()]).optional(),
  }),
}).refine(
  (d) => d.recipient.phone != null || d.recipient.Phone != null,
  { message: "Recipient must have phone", path: ["recipient"] }
);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createRecurringSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { triggerId, projectId, recipient, recurrence, endCondition } = parsed.data;
    const payload = { ...recipient } as Record<string, unknown>;
    if (!payload.phone && payload.Phone) payload.phone = payload.Phone;

    const nextRunAt = getNextRunAtISO(recurrence.type, recurrence.timeOfDay);

    const { data: row, error } = await supabase
      .from("scheduled_recurring")
      .insert({
        project_id: projectId,
        trigger_id: triggerId,
        recipient_payload: payload,
        recurrence_type: recurrence.type,
        time_of_day: recurrence.timeOfDay,
        timezone: recurrence.timezone ?? "UTC",
        end_type: endCondition.type,
        end_date: endCondition.type === "until_date" && typeof endCondition.value === "string"
          ? endCondition.value
          : null,
        end_after_count: endCondition.type === "after_count" && typeof endCondition.value === "number"
          ? endCondition.value
          : null,
        next_run_at: nextRunAt,
        status: "active",
      })
      .select("id, next_run_at")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: { id: row?.id, next_run_at: row?.next_run_at },
    });
  } catch (err) {
    console.error("Create recurring error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

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
    const projectId = searchParams.get("project_id");

    let query = supabase
      .from("scheduled_recurring")
      .select(`
        id,
        trigger_id,
        recipient_payload,
        recurrence_type,
        time_of_day,
        end_type,
        end_date,
        end_after_count,
        run_count,
        next_run_at,
        status,
        created_at,
        triggers (id, name, slug)
      `)
      .in("status", ["active", "paused"]);

    if (projectId) query = query.eq("project_id", projectId);

    const { data, error } = await query.order("next_run_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
