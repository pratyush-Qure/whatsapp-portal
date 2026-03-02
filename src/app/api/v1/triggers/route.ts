import { NextRequest, NextResponse } from "next/server";
import _get from "lodash/get";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createTriggerSchema } from "@/lib/utils/validation";
import { nanoid } from "nanoid";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const projectId = searchParams.get("project_id");
    const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    const offset = page * limit;

    let query = supabase
      .from("triggers")
      .select(`
        id,
        slug,
        name,
        source_type,
        status,
        template_id,
        recipient_path,
        created_at,
        project_id,
        templates (id, name, body)
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (projectId) query = query.eq("project_id", projectId);
    if (status && ["active", "paused", "draft"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    const projectSlugs = new Map<string, string>();
    if (data?.length) {
      const projectIds = [...new Set((data as { project_id?: string }[]).map((t) => t.project_id).filter(Boolean))];
      if (projectIds.length) {
        const { data: projs } = await supabase.from("projects").select("id, slug").in("id", projectIds);
        for (const p of projs ?? []) {
          projectSlugs.set(p.id, _get(p, "slug", "default") as string);
        }
      }
    }

    const baseUrl = _get(process.env, "NEXT_PUBLIC_APP_URL", "http://localhost:3000") as string;
    const items = (data ?? []).map((t) => {
      const pid = _get(t, "project_id");
      const projectSlug = (pid && projectSlugs.get(pid)) ?? "default";
      const { project_id, templates, ...rest } = t as { project_id?: string; templates?: unknown; [k: string]: unknown };
      return {
        ...rest,
        project_id: pid,
        templates,
        webhook_url: `${baseUrl}/api/v1/inbound/${projectSlug}/${t.slug}`,
      };
    });

    return NextResponse.json({
      success: true,
      data: items,
      pagination: { page, limit, total: count ?? 0 },
    });
  } catch (err) {
    console.error("Triggers GET error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createTriggerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const secret = nanoid(32);

    const { data: trigger, error } = await supabase
      .from("triggers")
      .insert({
        project_id: data.project_id,
        slug: data.slug,
        name: data.name,
        source_type: data.source_type,
        template_id: data.template_id,
        recipient_path: data.recipient_path,
        config_json: {
          ...data.config_json,
          signature_secret: secret,
          http_method: (data.config_json?.http_method as string) || "POST",
        },
        conditions_json: data.conditions_json ?? null,
        status: data.status,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { success: false, error: "SLUG_EXISTS", message: "Trigger slug already exists" },
          { status: 409 }
        );
      }
      throw error;
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    let projectSlug = "default";
    if (trigger?.project_id) {
      const { data: proj } = await supabase.from("projects").select("slug").eq("id", trigger.project_id).maybeSingle();
      projectSlug = _get(proj, "slug", "default") as string;
    }
    const webhookUrl = `${baseUrl}/api/v1/inbound/${projectSlug}/${trigger!.slug}`;
    return NextResponse.json(
      {
        success: true,
        data: {
          ...trigger,
          webhook_url: webhookUrl,
          signature_secret: secret,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Triggers POST error:", err);
    return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
