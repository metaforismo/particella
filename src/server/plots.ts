import { LatLon, LayerId, PlotReport, type Plot } from "#contracts";
import { getCountry } from "#server/countries/index.ts";
import type { CountryAdapter } from "#server/countries/types.ts";
import { parseLotId, aggregatePlots } from "#server/lots.ts";
import { cache, canonicalKey, type Cache } from "#server/core/cache.ts";
import { layerCatalog, runLayer, singleLayerTimeoutMs } from "#server/core/layers.ts";
import { BadRequest, NotFound, UpstreamError } from "#server/core/errors.ts";
import { z } from "zod";
import { ServerTiming } from "#server/core/timing.ts";

export const plotQuery = z.object({ at: z.string().max(2000).optional() }).strict();

export function parseAt(at?: string | LatLon): LatLon | undefined {
  if (at === undefined) return undefined;
  let value: unknown = at;
  if (typeof at === "string") {
    if (!/^-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?$/.test(at))
      throw new BadRequest("Il parametro at deve contenere latitudine,longitudine valide.");
    const [lat, lon] = at.split(",").map(Number);
    value = { lat, lon };
  }
  const parsed = LatLon.safeParse(value);
  if (!parsed.success) throw new BadRequest("Il parametro at deve contenere latitudine,longitudine valide.");
  return parsed.data;
}

const resolvingPlots = new WeakMap<Cache, WeakMap<CountryAdapter, Map<string, Promise<Plot>>>>();

export function createPlotResolver(country: CountryAdapter, storage: Cache = cache) {
  const countries = resolvingPlots.get(storage) ?? new WeakMap<CountryAdapter, Map<string, Promise<Plot>>>();
  resolvingPlots.set(storage, countries);
  const pending = countries.get(country) ?? new Map<string, Promise<Plot>>();
  countries.set(country, pending);
  return async function resolve(id: string, at?: string | LatLon, signal?: AbortSignal): Promise<Plot> {
    const deadline = AbortSignal.any([AbortSignal.timeout(200_000), ...(signal ? [signal] : [])]);
    if (deadline.aborted) throw new UpstreamError("Richiesta interrotta.");
    const ids = parseLotId(id);
    if (ids.length > 1) {
      if (at !== undefined && typeof at !== "string")
        throw new BadRequest(
          "Per un lotto composto usare un punto per particella separato da punto e virgola.",
        );
      const points = typeof at === "string" ? at.split(";").map((p) => parseAt(p)) : ids.map(() => undefined);
      if (points.length !== ids.length)
        throw new BadRequest("Indicare un punto per ogni particella, nello stesso ordine degli ID.");
      const plots: Plot[] = [];
      for (let i = 0; i < ids.length; i++) plots.push(await resolve(ids[i], points[i], deadline));
      return aggregatePlots(plots);
    }
    const point = parseAt(at);
    const key = canonicalKey("plot:v1", id);
    const stored = await storage.get<Plot | { missing: true }>(key);
    if (stored && !("missing" in stored)) return stored;
    // A negative ID lookup cannot suppress a new spatial lookup. Concurrent routes share
    // only an identical ID + point lookup, not different points or different countries/caches.
    const pendingKey = canonicalKey("plot:pending:v1", { id, point });
    const existing = pending.get(pendingKey);
    if (existing) return existing;
    const task = (async () => {
      const plot = point
        ? await country.plotAt(point.lat, point.lon, AbortSignal.any([deadline, AbortSignal.timeout(25_000)]))
        : await country.plotById(id, deadline);
      if (plot.id !== id) throw new NotFound("Il punto indicato non ricade nella particella richiesta.");
      await storage.set(key, plot, 86_400_000);
      return plot;
    })().finally(() => pending.delete(pendingKey));
    pending.set(pendingKey, task);
    return task;
  };
}

export async function resolvePlot(id: string, at?: string | LatLon, signal?: AbortSignal): Promise<Plot> {
  return createPlotResolver(getCountry("it"))(id, at, signal);
}

export async function getPlotLayer(
  id: string,
  layer: LayerId,
  at?: string | LatLon,
  timing = new ServerTiming(),
) {
  const selected = LayerId.parse(layer);
  const plot = await timing.measure("cadastre", () => resolvePlot(id, at));
  return timing.measure(selected, () =>
    runLayer(selected, plot, getCountry(plot.country).layers[selected], singleLayerTimeoutMs(selected)),
  );
}

/** Import directly from a Server Component, including /scheda/[id]?at=lat,lon. */
export async function getPlotReport(id: string, at?: string | LatLon, timing = new ServerTiming()) {
  const plot = await timing.measure("cadastre", () => resolvePlot(id, at));
  const country = getCountry(plot.country);
  const layers = await Promise.all(
    layerCatalog.map(({ id }) => timing.measure(id, () => runLayer(id, plot, country.layers[id]))),
  );
  return PlotReport.parse({ plot, layers, generatedAt: new Date().toISOString() });
}
