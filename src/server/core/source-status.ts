import { z } from "zod";
import { SourceStatusResponse } from "#contracts";
import { configuredRedis, type RedisRestClient } from "#server/core/redis.ts";
import { sources } from "#server/core/sources.ts";
import { logEvent } from "#server/core/observability.ts";

const Observation = z.object({
  at: z.number().finite(),
  durationMs: z.number().nonnegative(),
  state: z.enum(["ok", "slow", "error"]),
});
type Observation = z.infer<typeof Observation>;
const RECENT_MS = 15 * 60_000;
const RETENTION_MS = 24 * 60 * 60_000;
const MAX_SAMPLES = 20;
const SLOW_MS = 3000;
export interface ObservationStore {
  readonly scope: "instance" | "shared";
  record(sourceId: string, observation: Observation): Promise<void>;
  read(sourceId: string): Promise<Observation[]>;
}
export class MemoryObservationStore implements ObservationStore {
  readonly scope = "instance";
  private entries = new Map<string, Observation[]>();
  async record(id: string, observation: Observation) {
    this.entries.set(
      id,
      [observation, ...(this.entries.get(id) ?? [])].sort((a, b) => b.at - a.at).slice(0, MAX_SAMPLES),
    );
  }
  async read(id: string) {
    return (this.entries.get(id) ?? []).filter((o) => Date.now() - o.at < RETENTION_MS);
  }
}
const RECORD_SCRIPT = `redis.call('LPUSH', KEYS[1], ARGV[1])
redis.call('LTRIM', KEYS[1], 0, 19)
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return 1`;
export class RedisObservationStore implements ObservationStore {
  readonly scope = "shared";
  private readonly redis: RedisRestClient;
  constructor(redis: RedisRestClient) {
    this.redis = redis;
  }
  private key(id: string) {
    return `particella:source-status:v1:${id}`;
  }
  async record(id: string, observation: Observation) {
    await this.redis.command([
      "EVAL",
      RECORD_SCRIPT,
      1,
      this.key(id),
      JSON.stringify(observation),
      RETENTION_MS,
    ]);
  }
  async read(id: string) {
    const result = await this.redis.command(["LRANGE", this.key(id), 0, MAX_SAMPLES - 1]);
    return z
      .array(z.string())
      .parse(result)
      .map((s) => Observation.parse(JSON.parse(s)))
      .sort((a, b) => b.at - a.at)
      .filter((o) => Date.now() - o.at < RETENTION_MS);
  }
}

const local = new MemoryObservationStore();
let shared: RedisObservationStore | undefined;
try {
  const redis = configuredRedis();
  if (redis) shared = new RedisObservationStore(redis);
} catch {
  logEvent({ event: "operational", outcome: "source_status_memory_fallback", scope: "instance" });
}

export async function recordSource(id: string | undefined, durationMs: number, ok: boolean) {
  if (!id || !sources.some((s) => s.id === id)) return;
  const observation: Observation = {
    at: Date.now(),
    durationMs: Math.round(durationMs),
    state: ok ? (durationMs >= SLOW_MS ? "slow" : "ok") : "error",
  };
  await local.record(id, observation);
  if (shared)
    await shared.record(id, observation).catch(() => {
      logEvent({ event: "operational", outcome: "source_status_write_failed", scope: "instance" });
    });
}
export function sourceForUrl(input: string): string | undefined {
  const url = new URL(input);
  return sources
    .filter((s) => {
      const endpoint = new URL(s.endpoint);
      return (
        url.host === endpoint.host &&
        url.pathname === endpoint.pathname &&
        [...endpoint.searchParams].every(([k, v]) => url.searchParams.get(k) === v)
      );
    })
    .sort((a, b) => b.endpoint.length - a.endpoint.length)[0]?.id;
}
export async function sourceStatuses(store?: ObservationStore) {
  const now = Date.now();
  const result = await Promise.all(
    sources.map(async (s) => {
      let storage = store ?? shared ?? local;
      let samples: Observation[];
      try {
        samples = await storage.read(s.id);
      } catch {
        storage = local;
        samples = await storage.read(s.id);
      }
      const latest = samples[0];
      const recent = samples
        .filter((o) => now - o.at <= RECENT_MS)
        .map((o) => o.durationMs)
        .sort((a, b) => a - b);
      const middle = Math.floor(recent.length / 2);
      const median = recent.length
        ? recent.length % 2
          ? recent[middle]
          : (recent[middle - 1] + recent[middle]) / 2
        : null;
      return {
        sourceId: s.id,
        state: latest?.state ?? "unknown",
        medianLatencyMs: median,
        checkedAt: latest ? new Date(latest.at).toISOString() : null,
        sampleCount: recent.length,
        scope: storage.scope,
        provenance: {
          sourceId: s.id,
          dataset: "Stato del trasporto HTTP osservato da Particella",
          authority: "Particella",
          license: "CC BY 4.0",
          url: s.url,
          method: "computed",
          isOfficial: false,
          retrievedAt: new Date(now).toISOString(),
        },
      };
    }),
  );
  return SourceStatusResponse.parse(result);
}
