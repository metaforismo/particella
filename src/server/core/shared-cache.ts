import { createHash } from "node:crypto";
import { serialize, deserialize } from "node:v8";
import type { Cache } from "#server/core/cache.ts";

/** Redis REST command API (e.g. Upstash). Optional; binary HTTP payloads survive round trips. */
export class RedisRestCache implements Cache {
  private readonly endpoint: string;
  private readonly token: string;
  private readonly fetcher: typeof fetch;
  constructor(endpoint: string, token: string, fetcher: typeof fetch = (...args) => fetch(...args)) {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !token)
      throw new Error("Invalid shared cache configuration");
    this.endpoint = url.toString();
    this.token = token;
    this.fetcher = fetcher;
  }
  private key(key: string) {
    return `particella:v1:${createHash("sha256").update(key).digest("hex")}`;
  }
  private async command(command: (string | number)[]) {
    const response = await this.fetcher(this.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(250),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("Shared cache unavailable");
    }
    const text = await response.text();
    if (text.length > 24_000_000) throw new Error("Shared cache value exceeds limit");
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== "object" || !("result" in data) || "error" in data)
      throw new Error("Invalid shared cache response");
    return data.result;
  }
  async get<T>(key: string): Promise<T | undefined> {
    const result = await this.command(["GET", this.key(key)]);
    if (result === null) return undefined;
    if (typeof result !== "string" || result.length > 20_000_000)
      throw new Error("Invalid shared cache value");
    const stored = deserialize(Buffer.from(result, "base64")) as { expiresAt: number; value: T };
    if (!stored || !Number.isFinite(stored.expiresAt)) throw new Error("Invalid shared cache expiry");
    return stored.expiresAt > Date.now() ? stored.value : undefined;
  }
  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    if (!Number.isSafeInteger(ttlMs)) return;
    if (ttlMs <= 0) {
      await this.command(["DEL", this.key(key)]);
      return;
    }
    const bytes = serialize({ value, expiresAt: Date.now() + ttlMs });
    if (bytes.length > 3_000_000) return;
    await this.command(["SET", this.key(key), bytes.toString("base64"), "PX", ttlMs]);
  }
}

/** Local-first, fail-open storage. An outage never becomes a provider failure. */
export class FallbackCache implements Cache {
  private retryAt = 0;
  private readonly local: Cache;
  private readonly shared: Cache;
  private readonly now: () => number;
  constructor(local: Cache, shared: Cache, now: () => number = Date.now) {
    this.local = local;
    this.shared = shared;
    this.now = now;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.local.get<T>(key);
    if (value !== undefined || this.now() < this.retryAt) return value;
    try {
      return await this.shared.get<T>(key);
    } catch {
      this.retryAt = this.now() + 30_000;
      return undefined;
    }
  }
  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    await this.local.set(key, value, ttlMs);
    if (this.now() < this.retryAt) return;
    try {
      await this.shared.set(key, value, ttlMs);
    } catch {
      this.retryAt = this.now() + 30_000;
    }
  }
}
