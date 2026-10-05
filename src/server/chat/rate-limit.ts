import { RateLimited } from "#server/core/errors.ts";
import { hash } from "#server/core/http.ts";

/**
 * Client address for rate limiting. `x-real-ip` is set by the platform (Vercel) and cannot be forged
 * by the caller; otherwise the rightmost `x-forwarded-for` hop is the one our nearest proxy appended.
 * The leftmost value is client-controlled and is never trusted.
 */
export function clientAddress(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const hops = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  return hops?.at(-1) ?? "local";
}

export class ChatRateLimiter {
  private entries = new Map<string, { until: number; count: number }>();

  private global = { until: 0, count: 0 };

  /** Caps model calls per instance whatever the addresses, so spoofing cannot run up the bill. */
  private readonly globalLimit: number;

  private readonly limit: number;

  private readonly windowMs: number;

  private readonly now: () => number;

  constructor(limit = 8, windowMs = 60_000, now = Date.now, globalLimit = 120) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.globalLimit = globalLimit;
  }

  consume(request: Request): void {
    const now = this.now();
    for (const [key, entry] of this.entries) if (entry.until <= now) this.entries.delete(key);
    if (this.global.until <= now) this.global = { until: now + this.windowMs, count: 0 };
    if (this.global.count >= this.globalLimit)
      throw new RateLimited(
        "L’assistente è molto richiesto: riprova tra un minuto.",
        Math.ceil((this.global.until - now) / 1000),
      );
    const key = hash(clientAddress(request));
    const existing = this.entries.get(key);
    if (!existing && this.entries.size >= 10_000) throw new RateLimited();
    const entry = existing ?? { until: now + this.windowMs, count: 0 };
    if (entry.count >= this.limit)
      throw new RateLimited("Troppi messaggi: riprova tra un minuto.", Math.ceil((entry.until - now) / 1000));
    entry.count++;
    this.global.count++;
    this.entries.set(key, entry);
  }
}

export const chatRateLimiter = new ChatRateLimiter();
