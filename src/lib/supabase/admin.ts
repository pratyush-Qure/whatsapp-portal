import { createClient } from "@supabase/supabase-js";

/**
 * Admin client with service role key - bypasses RLS.
 * Use ONLY in server-side code (API routes, Server Actions).
 * Never expose the service role key to the client.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}
