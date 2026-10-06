import { configuredRedis, type RedisRestClient } from "#server/core/redis.ts";
import { RateLimited } from "#server/core/errors.ts";
import { logEvent } from "#server/core/observability.ts";
import { bearerDigest, clientAddress, keyDigest, matchesKey } from "#server/http/identity.ts";
import { looksCadastral } from "#lib/cadastral.ts";

export interface CounterStore {
  consume(key: string, windowMs: number): Promise<{ count: number; retryAfterSeconds: number }>;
}
export class MemoryCounterStore implements CounterStore {
  private entries = new Map<string, { count: number; until: number }>();
  private readonly now: () => number;
  constructor(now = Date.now) {
    this.now = now;
  }
  async consume(key: string, windowMs: number) {
    const now = this.now();
    for (const [k, entry] of this.entries) if (entry.until <= now) this.entries.delete(k);
    if (!this.entries.has(key) && this.entries.size >= 10_000) throw new RateLimited();
    const entry = this.entries.get(key) ?? { count: 0, until: now + windowMs };
    entry.count++;
    this.entries.set(key, entry);
    return { count: entry.count, retryAfterSeconds: Math.max(1, Math.ceil((entry.until - now) / 1000)) };
  }
}
// INCR and expiry are one atomic operation; never use the cache's read/modify/write counters.
export const COUNTER_SCRIPT = `local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return {n, redis.call('PTTL', KEYS[1])}`;
export class RedisCounterStore implements CounterStore {
  private readonly redis: RedisRestClient;
  constructor(redis: RedisRestClient) {
    this.redis = redis;
  }
  async consume(key: string, windowMs: number) {
    const result = await this.redis.command([
      "EVAL",
      COUNTER_SCRIPT,
      1,
      `particella:limits:v1:${key}`,
      windowMs,
    ]);
    if (
      !Array.isArray(result) ||
      result.length !== 2 ||
      !result.every((v) => Number.isSafeInteger(v)) ||
      result[0] < 1 ||
      result[1] < 0
    )
      throw new Error("Invalid counter response");
    return { count: result[0] as number, retryAfterSeconds: Math.max(1, Math.ceil(result[1] / 1000)) };
  }
}

/** Shared outage degrades to explicitly logged instance limits, with a short circuit breaker. */
export class FallbackCounterStore implements CounterStore {
  private readonly shared: CounterStore;
  private readonly local: CounterStore;
  private retryAt = 0;
  constructor(shared: CounterStore, local: CounterStore = new MemoryCounterStore()) {
    this.shared = shared;
    this.local = local;
  }
  async consume(key: string, windowMs: number) {
    if (Date.now() >= this.retryAt) {
      try {
        return await this.shared.consume(key, windowMs);
      } catch {
        this.retryAt = Date.now() + 30_000;
        logEvent({ event: "operational", outcome: "rate_limit_memory_fallback", scope: "instance" });
      }
    }
    return this.local.consume(key, windowMs);
  }
}
export function rateBucket(path: string, query?: URLSearchParams): "light" | "heavy" {
  return (path === "/api/v1/geocode" && !looksCadastral(query?.get("q") ?? "")) ||
    path.startsWith("/api/v1/catalog/") ||
    path === "/api/v1/openapi.json" ||
    (path === "/api/v1/status" && query?.get("probe") !== "1")
    ? "light"
    : "heavy";
}
export const API_LIMITS = {
  light: { anonymous: 60, keyed: 600 },
  heavy: { anonymous: 120, keyed: 1200 },
} as const;

export async function enforceApiLimit(request: Request, store: CounterStore): Promise<void> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/v1/") || url.pathname === "/api/v1/health") return;
  const digest = bearerDigest(request);
  const keyed = matchesKey(digest, process.env.PARTICELLA_API_KEYS);
  const bucket = rateBucket(url.pathname, url.searchParams);
  // Always per client address, including keyed traffic. The tier shares the bucket across keys.
  const key = keyDigest(`${clientAddress(request)}:${bucket}:${keyed ? "keyed" : "anonymous"}`);
  const result = await store.consume(key, 60_000);
  if (result.count > API_LIMITS[bucket][keyed ? "keyed" : "anonymous"])
    throw new RateLimited("Limite temporaneo di richieste raggiunto.", result.retryAfterSeconds);
}
export function configuredCounterStore(): CounterStore {
  const redis = configuredRedis();
  return redis ? new FallbackCounterStore(new RedisCounterStore(redis)) : new MemoryCounterStore();
}
