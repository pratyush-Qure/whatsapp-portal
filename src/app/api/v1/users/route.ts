import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type ProjectUserRow = {
  phone: string;
  name: string | null;
  groups: { id: string; name: string }[];
  triggers: { id: string; name: string; template_name: string }[];
};

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
    const projectSlug = searchParams.get("project");
    const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

    if (!projectSlug) {
      return NextResponse.json({ success: false, error: "Missing project" }, { status: 400 });
    }

    const { data: project } = await supabase
      .from("projects")
      .select("id, slug, name")
      .eq("slug", projectSlug)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const projectId = project.id;

    const { data: groups } = await supabase
      .from("groups")
      .select("id, name")
      .eq("project_id", projectId);
    const groupIds = (groups ?? []).map((g) => g.id);
    const groupMap = new Map((groups ?? []).map((g) => [g.id, g.name]));

    if (groupIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    let membersQuery = supabase
      .from("group_members")
      .select("group_id, phone, name")
      .in("group_id", groupIds);

    if (q) {
      membersQuery = membersQuery.or(
        `phone.ilike.%${q}%,name.ilike.%${q}%`
      );
    }

    const { data: members } = await membersQuery;

    const { data: triggerGroups } = await supabase
      .from("trigger_groups")
      .select("trigger_id, group_id")
      .in("group_id", groupIds);

    const triggerIds = [...new Set((triggerGroups ?? []).map((r) => r.trigger_id))];
    const { data: triggersWithTemplates } =
      triggerIds.length > 0
        ? await supabase
            .from("triggers")
            .select("id, name, template_id")
            .in("id", triggerIds)
        : { data: [] };
    const templateIds = (triggersWithTemplates ?? [])
      .map((t) => t.template_id)
      .filter(Boolean) as string[];
    const { data: templates } =
      templateIds.length > 0
        ? await supabase.from("templates").select("id, name").in("id", templateIds)
        : { data: [] };
    const templateMap = new Map((templates ?? []).map((t) => [t.id, t.name]));
    const triggerInfoMap = new Map(
      (triggersWithTemplates ?? []).map((t) => [
        t.id,
        {
          id: t.id,
          name: t.name,
          template_name: templateMap.get(t.template_id ?? "") ?? "—",
        },
      ])
    );

    const phoneToGroupIds = new Map<string, Set<string>>();
    const phoneToName = new Map<string, string | null>();
    for (const m of members ?? []) {
      const phone = (m.phone ?? "").trim();
      if (!phone) continue;
      if (!phoneToGroupIds.has(phone)) {
        phoneToGroupIds.set(phone, new Set());
        phoneToName.set(phone, m.name?.trim() || null);
      }
      phoneToGroupIds.get(phone)!.add(m.group_id);
      if ((m.name ?? "").trim() && !phoneToName.get(phone)) {
        phoneToName.set(phone, (m.name ?? "").trim());
      }
    }

    const users: ProjectUserRow[] = [];
    for (const [phone, gIds] of phoneToGroupIds) {
      const groupList = [...gIds].map((gid) => ({
        id: gid,
        name: groupMap.get(gid) ?? "—",
      }));
      const triggerIdsForUser = new Set<string>();
      for (const tg of triggerGroups ?? []) {
        if (gIds.has(tg.group_id)) triggerIdsForUser.add(tg.trigger_id);
      }
      const triggerList = [...triggerIdsForUser]
        .map((tid) => triggerInfoMap.get(tid))
        .filter(Boolean) as { id: string; name: string; template_name: string }[];
      users.push({
        phone,
        name: phoneToName.get(phone) ?? null,
        groups: groupList,
        triggers: triggerList,
      });
    }
    users.sort((a, b) => a.phone.localeCompare(b.phone));

    return NextResponse.json({ success: true, data: users });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch users";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
