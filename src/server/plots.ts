import { LatLon, LayerId, PlotReport, type Plot } from "#contracts";
import { getCountry } from "#server/countries/index.ts";
import type { CountryAdapter } from "#server/countries/types.ts";
import { parsePlotId } from "#server/countries/it/cadastre.ts";
import { cache, canonicalKey, type Cache } from "#server/core/cache.ts";
import { layerCatalog, runLayer } from "#server/core/layers.ts";
import { BadRequest, NotFound } from "#server/core/errors.ts";
import { z } from "zod";
import { ServerTiming } from "#server/core/timing.ts";

export const plotQuery = z.object({ at: z.string().max(64).optional() }).strict();

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

export function createPlotResolver(country: CountryAdapter, storage: Cache = cache) {
  return async function resolve(id: string, at?: string | LatLon): Promise<Plot> {
    parsePlotId(id);
    const point = parseAt(at);
    const key = canonicalKey("plot:v1", id);
    const stored = await storage.get<Plot | { missing: true }>(key);
    if (stored && !("missing" in stored)) return stored;
    // A negative ID lookup cannot suppress a new spatial lookup.
    const plot = point
      ? await country.plotAt(point.lat, point.lon, AbortSignal.timeout(25_000))
      : await country.plotById(id, AbortSignal.timeout(25_000));
    if (plot.id !== id) throw new NotFound("Il punto indicato non ricade nella particella richiesta.");
    await storage.set(key, plot, 86_400_000);
    return plot;
  };
}

export async function resolvePlot(id: string, at?: string | LatLon): Promise<Plot> {
  return createPlotResolver(getCountry("it"))(id, at);
}

export async function getPlotLayer(
  id: string,
  layer: LayerId,
  at?: string | LatLon,
  timing = new ServerTiming(),
) {
  const selected = LayerId.parse(layer);
  const plot = await timing.measure("cadastre", () => resolvePlot(id, at));
  return timing.measure(selected, () => runLayer(selected, plot, getCountry(plot.country).layers[selected]));
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
