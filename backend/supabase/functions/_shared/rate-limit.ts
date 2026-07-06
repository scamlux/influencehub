// Lightweight fixed-window rate limiter for edge functions (T-11).
//
// In-memory and per-instance: Fluid Compute reuses instances so this catches
// the common burst/abuse case cheaply without external state. It is a first
// line of defence, not a distributed quota — pair with Supabase's platform
// limits for hard guarantees. Keyed by client IP (x-forwarded-for) + a bucket
// name so different functions don't share counters.

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

/**
 * Allow up to `limit` requests per `windowSec` for a given key. Call once per
 * request; a false `allowed` means respond 429.
 */
export function rateLimit(
  key: string,
  { limit = 60, windowSec = 60 }: { limit?: number; windowSec?: number } = {},
): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || now >= existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  return { allowed: true, remaining: limit - existing.count, retryAfterSec: 0 };
}

/** Convenience: build a 429 Response with a Retry-After header. */
export function tooManyRequests(retryAfterSec: number, body: unknown = { error: "Too many requests" }): Response {
  return new Response(JSON.stringify(body), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfterSec),
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/** Occasionally evict expired windows so the map doesn't grow unbounded. */
export function sweepExpired(): void {
  const now = Date.now();
  for (const [k, w] of windows) {
    if (now >= w.resetAt) windows.delete(k);
  }
}
