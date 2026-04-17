// Proxied magic-link endpoint met rate-limit. Client roept /api/auth/magic-link
// aan ipv direct supabase.auth.signInWithOtp() zodat we rate-limiting kunnen
// toepassen op de server.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { emailSchema } from "@verkoopassistent/shared";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";
import { apiErrors, getCorrelationId } from "@/lib/api-error";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const bodySchema = z.object({ email: emailSchema });

// 5 pogingen per 15 min per IP + per email (whichever fires first).
const PER_IP_LIMIT = 5;
const PER_EMAIL_LIMIT = 3;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiErrors.validation(
      "Ongeldig email",
      parsed.error.issues,
      correlationId,
    );
  }

  const ip = ipFromRequest(req);
  const ipLimit = rateLimit(`magic-link:ip:${ip}`, PER_IP_LIMIT, WINDOW_MS);
  if (!ipLimit.allowed) return apiErrors.rateLimited(correlationId);
  const emailLimit = rateLimit(
    `magic-link:email:${parsed.data.email.toLowerCase()}`,
    PER_EMAIL_LIMIT,
    WINDOW_MS,
  );
  if (!emailLimit.allowed) return apiErrors.rateLimited(correlationId);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });
  if (error) {
    // Niet het interne bericht lekken — generiek.
    return NextResponse.json(
      {
        error: "Magic link kan nu niet worden verstuurd",
        code: "DEPENDENCY_ERROR",
        correlation_id: correlationId,
      },
      {
        status: 502,
        headers: {
          "X-RateLimit-Limit": String(PER_IP_LIMIT),
          "X-RateLimit-Remaining": String(ipLimit.remaining),
        },
      },
    );
  }

  return NextResponse.json(
    { sent: true, correlation_id: correlationId },
    {
      headers: {
        "X-RateLimit-Limit": String(PER_IP_LIMIT),
        "X-RateLimit-Remaining": String(ipLimit.remaining),
      },
    },
  );
}
