export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
}

export function canonicalKey(namespace: string, value: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(normalize);
    if (v !== null && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, normalize(x)]));
    }
    return v;
  };
  return `${namespace}:${JSON.stringify(normalize(value))}`;
}

export class MemoryCache implements Cache {
  private entries = new Map<string, { value: unknown; expires: number }>();
  private readonly capacity: number;
  private readonly now: () => number;
  constructor(capacity = 512, now: () => number = Date.now) {
    this.capacity = capacity;
    this.now = now;
    if (capacity < 1) throw new Error("Cache capacity must be positive");
  }
  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (entry.expires <= this.now()) return undefined;
    this.entries.set(key, entry);
    return structuredClone(entry.value) as T;
  }
  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.entries.delete(key);
    if (ttlMs <= 0) return;
    this.entries.set(key, { value: structuredClone(value), expires: this.now() + ttlMs });
    while (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value!);
  }
}

export const cache: Cache = new MemoryCache();
export const NEGATIVE_TTL_MS = 30_000;
