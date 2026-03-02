import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseBrowserEnv } from "@/lib/supabase/env";

const projectRequiredPaths = ["/send", "/queue", "/triggers", "/analytics", "/groups", "/users"];

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

function isPublicApiPath(pathname: string) {
  return (
    pathname.startsWith("/api/v1/inbound/") ||
    pathname === "/api/v1/webhooks/twilio" ||
    pathname === "/api/cron/process-queue"
  );
}

/** All pages require auth except /login and public API routes; used to redirect unauthenticated users to /login. */
function shouldRequireAuth(pathname: string) {
  if (pathname === "/login") return false;
  if (isApiPath(pathname)) return !isPublicApiPath(pathname);
  return true;
}

function isProjectRequiredPath(pathname: string) {
  return projectRequiredPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function updateSession(request: NextRequest) {
  // DEBUG: Skip auth validation when SKIP_AUTH_DEBUG=true in .env.local
  if (process.env.SKIP_AUTH_DEBUG === "true") {
    return NextResponse.next({ request });
  }

  const pathname = request.nextUrl.pathname;

  const env = getSupabaseBrowserEnv();
  if (!env) {
    // Supabase not configured: still redirect protected pages to login so we never serve app UI
    if (shouldRequireAuth(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.url,
    env.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options ?? {});
          });
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Handle invalid/expired refresh token - clear session and redirect to login
  if (authError) {
    const isInvalidToken =
      authError.message?.includes("Refresh Token") ||
      authError.message?.includes("refresh_token") ||
      authError.name === "AuthApiError";

    if (isInvalidToken) {
      await supabase.auth.signOut({ scope: "local" });
      if (shouldRequireAuth(pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("next", pathname);
        const redirectResponse = NextResponse.redirect(url);
        // Copy cleared auth cookies to redirect response so client drops invalid tokens
        response.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie.name, cookie.value, {
            path: "/",
            ...(cookie.value === "" ? { maxAge: 0 } : {}),
          });
        });
        return redirectResponse;
      }
    }
    return response;
  }

  // Not logged in: redirect to login for any protected page (all pages except /login and public API)
  if (!user && shouldRequireAuth(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && isProjectRequiredPath(pathname) && !request.nextUrl.searchParams.get("project")) {
    const url = request.nextUrl.clone();
    url.pathname = "/projects";
    return NextResponse.redirect(url);
  }

  return response;
}
