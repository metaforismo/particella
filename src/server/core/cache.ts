import { markCache, logEvent } from "#server/core/observability.ts";
import { serialize } from "node:v8";
import { RedisRestCache, FallbackCache } from "#server/core/shared-cache.ts";

export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
}

export function canonicalKey(namespace: string, value: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(normalize);
    if (v !== null && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, x]) => [k, normalize(x)]),
      );
    }
    return v;
  };
  return `${namespace}:${JSON.stringify(normalize(value))}`;
}

export class MemoryCache implements Cache {
  private entries = new Map<string, { value: unknown; expires: number; size: number }>();

  private bytes = 0;

  private readonly maxBytes: number;

  private readonly capacity: number;

  private readonly now: () => number;

  constructor(capacity = 512, now: () => number = Date.now, maxBytes = 64 * 1024 * 1024) {
    this.capacity = capacity;
    this.now = now;
    this.maxBytes = maxBytes;
    if (capacity < 1 || maxBytes < 1) throw new Error("Cache limits must be positive");
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) {
      markCache("miss");
      return undefined;
    }
    this.entries.delete(key);
    if (entry.expires <= this.now()) {
      this.bytes -= entry.size;
      markCache("miss");
      return undefined;
    }
    this.entries.set(key, entry);
    markCache("hit");
    return structuredClone(entry.value) as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    for (const [entryKey, entry] of this.entries) if (entry.expires <= this.now()) this.remove(entryKey);
    this.remove(key);
    if (ttlMs <= 0) return;
    const size = serialize(value).byteLength + key.length * 2;
    if (size > this.maxBytes / 4) return;
    this.entries.set(key, { value: structuredClone(value), expires: this.now() + ttlMs, size });
    this.bytes += size;
    while (this.entries.size > this.capacity || this.bytes > this.maxBytes)
      this.remove(this.entries.keys().next().value!);
  }

  private remove(key: string): void {
    const entry = this.entries.get(key);
    if (entry) this.bytes -= entry.size;
    this.entries.delete(key);
  }
}

const configuredBytes = Number(process.env.PARTICELLA_CACHE_MAX_BYTES ?? 64 * 1024 * 1024);

if (!Number.isSafeInteger(configuredBytes) || configuredBytes < 1)
  throw new Error("PARTICELLA_CACHE_MAX_BYTES must be a positive integer");

function configuredCache(): Cache {
  const local = new MemoryCache(512, Date.now, configuredBytes);
  const endpoint = process.env.PARTICELLA_CACHE_REDIS_REST_URL;
  const token = process.env.PARTICELLA_CACHE_REDIS_REST_TOKEN;
  if (!endpoint || !token) return local;
  try {
    return new FallbackCache(local, new RedisRestCache(endpoint, token));
  } catch {
    logEvent({ event: "operational", outcome: "shared_cache_configuration_invalid", scope: "instance" });
    return local;
  }
}

export const cache: Cache = configuredCache();

export const NEGATIVE_TTL_MS = 30_000;
