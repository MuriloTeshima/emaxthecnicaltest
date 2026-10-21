import "server-only";

/**
 * Fixed-window, in-memory rate limit. Good enough to stop casual abuse of the
 * public demo (each serverless instance keeps its own counters); a real
 * deployment would use a shared store such as Redis.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, { limit, windowMs }: { limit: number; windowMs: number }): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}
