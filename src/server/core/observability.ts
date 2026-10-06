import { AsyncLocalStorage } from "node:async_hooks";

const context = new AsyncLocalStorage<{ route: string; cache: "hit" | "miss" | "mixed" | "none" }>();
export function routeName(path: string): string {
  if (/^\/api\/v1\/tiles\//.test(path)) return "/api/v1/tiles/{overlay}/{z}/{x}/{y}";
  if (/^\/api\/v1\/plots\/[^/]+\/layers\//.test(path)) return "/api/v1/plots/{id}/layers/{layer}";
  if (/^\/api\/v1\/plots\/[^/]+\/report$/.test(path)) return "/api/v1/plots/{id}/report";
  if (/^\/api\/v1\/plots\/(?!at$)[^/]+$/.test(path)) return "/api/v1/plots/{id}";
  const publicPaths = new Set([
    "/api/v1/health",
    "/api/v1/status",
    "/api/v1/openapi.json",
    "/api/v1/geocode",
    "/api/v1/lots",
    "/api/v1/catalog/layers",
    "/api/v1/catalog/sources",
    "/api/v1/plots/at",
    "/api/v1/studio/chat",
  ]);
  return publicPaths.has(path) ? path : "unmatched";
}

type LogEvent = {
  event: "request" | "source" | "operational";
  route?: string;
  source?: string | null;
  host?: string | null;
  durationMs?: number;
  outcome: string;
  cache?: "hit" | "miss" | "none" | "mixed";
  status?: number;
  scope?: string;
};
/** Allowlisted fields only: no URLs, bodies, addresses, IDs, keys or exact coordinates. */
export function logEvent(event: LogEvent): void {
  console.info(JSON.stringify({ timestamp: new Date().toISOString(), ...event }));
}
export function markCache(outcome: "hit" | "miss") {
  const state = context.getStore();
  if (state) state.cache = state.cache === "none" ? outcome : state.cache === outcome ? outcome : "mixed";
}
export function sourceLog(
  source: string | null,
  host: string,
  started: number,
  outcome: string,
  cache: "hit" | "miss",
) {
  const state = context.getStore();
  markCache(cache);
  logEvent({
    event: "source",
    route: state?.route ?? "server",
    source,
    host,
    durationMs: Math.round(performance.now() - started),
    outcome,
    cache,
  });
}
export async function observeRequest(request: Request, action: () => Promise<Response>): Promise<Response> {
  const started = performance.now();
  const route = routeName(new URL(request.url).pathname);
  return context.run({ route, cache: "none" }, async () => {
    try {
      const response = await action();
      logEvent({
        event: "request",
        route,
        source: null,
        host: null,
        durationMs: Math.round(performance.now() - started),
        outcome: response.ok ? "ok" : "error",
        status: response.status,
        cache: context.getStore()?.cache ?? "none",
      });
      if (!response.headers.has("Server-Timing"))
        response.headers.set("Server-Timing", `total;dur=${(performance.now() - started).toFixed(1)}`);
      return response;
    } catch (error) {
      logEvent({
        event: "request",
        route,
        source: null,
        host: null,
        durationMs: Math.round(performance.now() - started),
        outcome: "error",
        status: 500,
        cache: "none",
      });
      throw error;
    }
  });
}
