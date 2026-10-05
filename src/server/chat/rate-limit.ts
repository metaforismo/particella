import { RateLimited } from "#server/core/errors.ts";
import { hash } from "#server/core/http.ts";

export class ChatRateLimiter {
  private entries = new Map<string, { until: number; count: number }>();

  private readonly limit: number;

  private readonly windowMs: number;

  private readonly now: () => number;

  constructor(limit = 8, windowMs = 60_000, now = Date.now) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }

  consume(request: Request): void {
    const now = this.now();
    for (const [key, entry] of this.entries) if (entry.until <= now) this.entries.delete(key);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
    const key = hash(ip);
    const existing = this.entries.get(key);
    if (!existing && this.entries.size >= 10_000) throw new RateLimited();
    const entry = existing ?? { until: now + this.windowMs, count: 0 };
    if (entry.count >= this.limit)
      throw new RateLimited("Troppi messaggi: riprova tra un minuto.", Math.ceil((entry.until - now) / 1000));
    entry.count++;
    this.entries.set(key, entry);
  }
}

export const chatRateLimiter = new ChatRateLimiter();
