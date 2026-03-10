/* ------------------------------------------------------------------ */
/*  Simple in-memory rate limiter                                      */
/*  Works for local review and single-instance deploys.               */
/*  For multi-instance production: replace with Upstash Redis.        */
/* ------------------------------------------------------------------ */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Cleanup stale buckets every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now > bucket.resetAt) buckets.delete(key);
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetIn: number; // ms until reset
}

/**
 * @param key      — identifier (IP address or user ID)
 * @param limit    — max requests per window
 * @param windowMs — window duration in ms (default: 60 seconds)
 */
export function checkRateLimit(
  key: string,
  limit = 30,
  windowMs = 60_000
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetIn: windowMs };
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, resetIn: bucket.resetAt - now };
  }

  bucket.count++;
  return { ok: true, remaining: limit - bucket.count, resetIn: bucket.resetAt - now };
}
