import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@verkoopassistent/shared";
import { env } from "@/lib/env";

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/api/auth/magic-link",
  // Gehoste MCP (fase 34): OAuth-metadata + endpoints regelen hun eigen auth
  // (bearer-token / PKCE / eigen sessiecheck), dus buiten de cookie-gate.
  "/.well-known/oauth-authorization-server",
  "/.well-known/oauth-protected-resource",
  "/api/mcp",
  "/mcp/authorize",
];

type CookieInput = { name: string; value: string; options?: CookieOptions };

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieInput[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Correlation ID voor alle requests — logs en client error tracking.
  const correlationId =
    request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  supabaseResponse.headers.set("x-correlation-id", correlationId);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    // API routes krijgen JSON 401, HTML routes krijgen een login-redirect.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Niet ingelogd" },
        { status: 401 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
