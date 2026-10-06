import { sources } from "#server/core/sources.ts";
import { recordSource } from "#server/core/source-status.ts";
import { sourceLog } from "#server/core/observability.ts";
import { configuredCounterStore, type CounterStore } from "#server/http/rate-limit.ts";
import { bearerDigest, matchesKey } from "#server/http/identity.ts";
import { BackendError, NotConfigured, RateLimited } from "#server/core/errors.ts";

const counters = configuredCounterStore();
/** A transport-only HEAD, sequentially per registry entry; never downloads datasets or archives. */
export async function probeSources(
  request: Request,
  fetcher: typeof fetch = fetch,
  store: CounterStore = counters,
) {
  if (!process.env.PARTICELLA_ADMIN_KEY_SHA256?.trim())
    throw new NotConfigured("Il controllo attivo non è configurato.");
  if (!matchesKey(bearerDigest(request), process.env.PARTICELLA_ADMIN_KEY_SHA256))
    throw new BackendError("unauthorized", "Chiave amministrativa richiesta.", 401);
  const result = await store.consume("source-probe-global", 60_000);
  if (result.count > 1)
    throw new RateLimited("Controllo già richiesto: riprovare tra un minuto.", result.retryAfterSeconds);
  // Four concurrent checks, with at most one HEAD per host at a time.
  const groups = Map.groupBy(sources, (s) => new URL(s.endpoint).host);
  const queue = [...groups.values()];
  await Promise.all(
    Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length)
        for (const s of queue.shift() ?? []) {
          const started = performance.now();
          let ok = false;
          try {
            const response = await fetcher(s.endpoint, {
              method: "HEAD",
              redirect: "error",
              cache: "no-store",
              signal: AbortSignal.any([request.signal, AbortSignal.timeout(2000)]),
            });
            ok = response.ok;
            await response.body?.cancel();
          } catch {
            /* Only an outcome is logged; provider errors may contain credentials or queries. */
          }
          const duration = performance.now() - started;
          await recordSource(s.id, duration, ok);
          sourceLog(s.id, new URL(s.endpoint).host, started, ok ? "ok" : "error", "miss");
        }
    }),
  );
}
