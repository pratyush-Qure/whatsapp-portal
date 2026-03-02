import _get from "lodash/get";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_PROJECT_ID = "d0000000-0000-4000-8000-000000000001";

export async function getProjectIdBySlug(slug: string | null): Promise<string> {
  if (!slug) return DEFAULT_PROJECT_ID;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error) return DEFAULT_PROJECT_ID;
    return _get(data, "id", DEFAULT_PROJECT_ID) as string;
  } catch {
    return DEFAULT_PROJECT_ID;
  }
}
