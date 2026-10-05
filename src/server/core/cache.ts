import { serialize } from "node:v8";

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
  constructor(capacity = 512, now: () => number = Date.now, maxBytes = 32 * 1024 * 1024) {
    this.capacity = capacity;
    this.now = now;
    this.maxBytes = maxBytes;
    if (capacity < 1 || maxBytes < 1) throw new Error("Cache limits must be positive");
  }
  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (entry.expires <= this.now()) {
      this.bytes -= entry.size;
      return undefined;
    }
    this.entries.set(key, entry);
    return structuredClone(entry.value) as T;
  }
  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.remove(key);
    if (ttlMs <= 0) return;
    const size = serialize(value).byteLength + key.length * 2;
    if (size > this.maxBytes) return;
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

export const cache: Cache = new MemoryCache();
export const NEGATIVE_TTL_MS = 30_000;
