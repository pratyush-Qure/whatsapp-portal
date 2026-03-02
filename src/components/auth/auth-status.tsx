"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type AuthState = {
  email: string | null;
  roleLabel: string | null;
  loading: boolean;
};

export function AuthStatus() {
  const supabaseReady = isSupabaseConfigured();
  const [state, setState] = useState<AuthState>({
    email: supabaseReady ? null : "Supabase not configured",
    roleLabel: null,
    loading: supabaseReady,
  });
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!supabaseReady) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data, error }) => {
      const noUser = error || !data?.user;
      const isProtectedPage = pathname !== "/login" && !pathname.startsWith("/unauthorized");
      if (noUser && isProtectedPage) {
        // Not logged in on a protected page: redirect to login (covers client nav / cache bypassing middleware)
        supabase.auth.signOut({ scope: "local" });
        const next = pathname && pathname !== "/" ? pathname : "/dashboard";
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        router.refresh();
        setState({ email: null, roleLabel: null, loading: false });
        return;
      }
      if (error) {
        setState({ email: null, roleLabel: null, loading: false });
        return;
      }
      const email = data.user?.email ?? null;
      fetch("/api/v1/me", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((payload) => {
          const role = payload?.data?.roles?.[0] ?? null;
          setState({ email, roleLabel: role, loading: false });
        })
        .catch(() => {
          setState({ email, roleLabel: null, loading: false });
        });
    });
  }, [supabaseReady, router, pathname]);

  async function onLogout() {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (state.loading) {
    return (
      <div className="h-10 rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-3 text-sm leading-10 text-[var(--text-base-secondary)]">
        Loading user...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="rounded-md border border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-3 py-2 text-sm">
        <div>{state.email ?? "Not logged in"}</div>
        {state.roleLabel ? (
          <div className="mt-1">
            <Badge variant="neutral">Role: {state.roleLabel}</Badge>
          </div>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onLogout}
      >
        Logout
      </Button>
    </div>
  );
}
