// Simpele in-memory rate limiter voor single-instance deployment.
// Voor horizontale schaal (meerdere Vercel instances): migreer naar Upstash
// Redis met @upstash/ratelimit. Voor solo-user is in-memory voldoende.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Cleanup elke 5 min zodat de map niet oneindig groeit.
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets.entries()) {
    if (b.resetAt < now) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }
  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }
  bucket.count++;
  return {
    allowed: true,
    remaining: limit - bucket.count,
    resetAt: bucket.resetAt,
  };
}

// Rate-limit voor dure AI/PDF-routes (maxDuration=300, Claude-vision/PDF).
// Per gebruiker zodat één account niet de kosten/capaciteit kan opstoken.
// Default: 20 zware calls per 5 minuten.
export function aiRateLimit(
  userId: string,
  scope = "ai",
  limit = 20,
  windowMs = 5 * 60 * 1000,
): RateLimitResult {
  return rateLimit(`${scope}:${userId}`, limit, windowMs);
}

export function ipFromRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
