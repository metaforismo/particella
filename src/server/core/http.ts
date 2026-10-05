import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { canonicalKey, cache, NEGATIVE_TTL_MS, type Cache } from "./cache.ts";
import { RateLimited, UpstreamError } from "./errors.ts";

export const USER_AGENT = "Particella/0.1 (+https://github.com/metaforismo/particella)";
export interface HostPolicy {
  concurrency: number;
  requestsPerSecond: number;
  requestsPerDay?: number;
}
export interface HostLimiter {
  acquire(host: string, policy: HostPolicy, signal: AbortSignal): Promise<() => void>;
  defer?(host: string, durationMs: number): void;
}

export class MemoryHostLimiter implements HostLimiter {
  private hosts = new Map<string, { active: number; next: number; day: string; count: number }>();
  defer(host: string, durationMs: number): void {
    const state = this.hosts.get(host);
    if (state) state.next = Math.max(state.next, Date.now() + durationMs);
  }
  async acquire(host: string, policy: HostPolicy, signal: AbortSignal): Promise<() => void> {
    if (!(policy.concurrency >= 1 && policy.requestsPerSecond > 0)) throw new Error("Invalid host policy");
    const state = this.hosts.get(host) ?? { active: 0, next: 0, day: "", count: 0 };
    this.hosts.set(host, state);
    while (true) {
      signal.throwIfAborted();
      const day = new Date().toISOString().slice(0, 10);
      if (state.day !== day) {
        state.day = day;
        state.count = 0;
      }
      if (policy.requestsPerDay && state.count >= policy.requestsPerDay) throw new RateLimited();
      const remaining = state.next - Date.now();
      if (state.active < policy.concurrency && remaining <= 0) {
        state.active++;
        state.count++;
        state.next = Date.now() + 1000 / policy.requestsPerSecond;
        return () => {
          state.active--;
        };
      }
      await delay(Math.max(5, Math.min(remaining > 0 ? remaining : 10, 100)), undefined, { signal });
    }
  }
}

export interface HttpPayload {
  bytes: Uint8Array;
  contentType: string;
  retrievedAt: string;
  requestUrl: string;
}
export interface HttpOptions {
  timeoutMs?: number;
  ttlMs?: number;
  retries?: number;
  signal?: AbortSignal;
  method?: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
  policy?: HostPolicy;
}
export function retryAfterMs(value: string | null, now = Date.now()): number | null {
  if (value === null) return null;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}
export function canonicalUrl(input: string): string {
  const url = new URL(input);
  url.hash = "";
  url.searchParams.sort();
  return url.toString();
}

export class HttpClient {
  private inFlight = new Map<string, Promise<HttpPayload>>();
  private readonly storage: Cache;
  private readonly limiter: HostLimiter;
  private readonly fetcher: typeof fetch;
  constructor(
    storage: Cache = cache,
    limiter: HostLimiter = new MemoryHostLimiter(),
    fetcher: typeof fetch = (...args) => fetch(...args),
  ) {
    this.storage = storage;
    this.limiter = limiter;
    this.fetcher = fetcher;
  }
  async request(input: string, options: HttpOptions = {}): Promise<HttpPayload> {
    const url = canonicalUrl(input);
    const key = canonicalKey("http:v1", {
      url,
      method: options.method ?? "GET",
      body: options.body,
      headers: options.headers,
    });
    const cached = await this.storage.get<HttpPayload | { failure: true; rateLimited: boolean }>(key);
    if (cached) {
      if ("failure" in cached) throw cached.rateLimited ? new RateLimited() : new UpstreamError();
      return cached;
    }
    if (options.signal?.aborted) throw new UpstreamError("Richiesta interrotta.");
    const existing = this.inFlight.get(key);
    if (existing) return waitForCaller(existing, options.signal);
    const task = this.execute(url, { ...options, signal: undefined })
      .then(async (result) => {
        await this.storage.set(key, result, options.ttlMs ?? 86_400_000);
        return result;
      })
      .catch(async (error: unknown) => {
        await this.storage.set(
          key,
          { failure: true, rateLimited: error instanceof RateLimited },
          NEGATIVE_TTL_MS,
        );
        throw error;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, task);
    return waitForCaller(task, options.signal);
  }
  private async execute(url: string, options: HttpOptions): Promise<HttpPayload> {
    const timeoutMs = options.timeoutMs ?? 15_000;
    const expiresAt = Date.now() + timeoutMs;
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
    const policy = options.policy ?? { concurrency: 2, requestsPerSecond: 2 };
    const transient = new Set([408, 429, 500, 502, 503, 504]);
    for (let attempt = 0; ; attempt++) {
      let wait = 0;
      const release = await this.limiter.acquire(new URL(url).host, policy, signal).catch(() => {
        if (signal.aborted) throw new UpstreamError("La fonte non ha risposto entro il tempo previsto.");
        throw new RateLimited();
      });
      try {
        const response = await this.fetcher(url, {
          method: options.method ?? "GET",
          body: options.body,
          signal,
          redirect: "error",
          cache: "no-store",
          headers: { ...options.headers, "User-Agent": USER_AGENT },
        });
        if (!response.ok) {
          await response.body?.cancel();
          if (!transient.has(response.status) || attempt >= (options.retries ?? 2)) {
            if (response.status === 429) throw new RateLimited();
            throw new UpstreamError(`La fonte ha restituito HTTP ${response.status}.`);
          }
          wait = Math.max(
            retryAfterMs(response.headers.get("retry-after")) ?? (response.status === 429 ? 30_000 : 0),
            250 * 2 ** attempt + Math.random() * 200,
          );
          this.limiter.defer?.(new URL(url).host, wait);
          if (response.status === 429 && Date.now() + wait >= expiresAt) throw new RateLimited();
        } else {
          const bytes = await readLimited(response, signal);
          checkProtocol(bytes, response.headers.get("content-type") ?? "");
          return {
            bytes,
            contentType: response.headers.get("content-type") ?? "",
            retrievedAt: new Date().toISOString(),
            requestUrl: url,
          };
        }
      } catch (error) {
        if (error instanceof UpstreamError || error instanceof RateLimited) throw error;
        if (signal.aborted || attempt >= (options.retries ?? 2))
          throw new UpstreamError("Connessione alla fonte non riuscita.");
        wait = 250 * 2 ** attempt + Math.random() * 200;
      } finally {
        release();
      }
      await delay(wait, undefined, { signal }).catch(() => {
        throw new UpstreamError("La fonte non ha risposto entro il tempo previsto.");
      });
    }
  }
}
function waitForCaller<T>(task: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return task;
  return new Promise((resolve, reject) => {
    const abort = () => reject(new UpstreamError("Richiesta interrotta."));
    signal.addEventListener("abort", abort, { once: true });
    task.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
}
function checkProtocol(bytes: Uint8Array, contentType: string): void {
  if (/image\/|application\/zip|octet-stream/.test(contentType)) return;
  const text = new TextDecoder().decode(bytes);
  if (
    /<(?:[\w-]+:)?(?:ExceptionReport|ServiceExceptionReport)\b/.test(text) ||
    /<!doctype html|<html\b/i.test(text)
  )
    throw new UpstreamError("Errore di protocollo della fonte.");
  if (contentType.includes("json")) {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new UpstreamError("JSON della fonte non valido.");
    }
    if (
      value &&
      typeof value === "object" &&
      ("error" in value ||
        "remark" in value ||
        ("status" in value && (value as { status: string }).status !== "OK"))
    )
      throw new UpstreamError("La fonte ha restituito un errore applicativo.");
  }
}
async function readLimited(response: Response, signal: AbortSignal): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) throw new UpstreamError("Risposta vuota della fonte.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const abort = () => {
    void reader.cancel(signal.reason).catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.length;
      if (size > 12_000_000) throw new UpstreamError("Risposta della fonte troppo grande.");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export const http = new HttpClient();
export const textBody = (payload: HttpPayload): string => new TextDecoder().decode(payload.bytes);
export function jsonBody(payload: HttpPayload): unknown {
  try {
    return JSON.parse(textBody(payload));
  } catch {
    throw new UpstreamError("Formato inatteso dalla fonte.");
  }
}
export const hash = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
