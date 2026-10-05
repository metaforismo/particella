import { z } from "zod";
import type { LayerProvider } from "../../../core/layers.ts";
import { layerResult } from "../../../core/layers.ts";
import { provenance } from "../../../core/provenance.ts";
import { jsonBody } from "../../../core/http.ts";
import { UpstreamError } from "../../../core/errors.ts";
import { parcelSamples, type PlotGeometry } from "../../../geo/index.ts";
import { estimateSlope, type HeightSample } from "../../../geo/terrain.ts";
import { fetchSource, wmsPointParams } from "../queries.ts";

const TinResponse = z.object({ features: z.array(z.object({ properties: z.object({ GRAY_INDEX: z.number().nullable() }) })) });
export function parseTinitaly(value: unknown): number | null {
  const result = TinResponse.safeParse(value);
  if (!result.success) throw new UpstreamError("Quota TINITALY non valida.");
  if (!result.data.features.length) return null;
  if (result.data.features.length !== 1) throw new UpstreamError("Quota TINITALY ambigua.");
  const height = result.data.features[0].properties.GRAY_INDEX;
  return height === null || height <= -9999 ? null : height;
}
const TopoResponse = z.object({ status: z.literal("OK"), results: z.array(z.object({ elevation: z.number().nullable(), location: z.object({ lat: z.number(), lng: z.number() }), dataset: z.literal("eudem25m") })) });
export const terrain: LayerProvider = async (plot, { signal }) => {
  const samples = plot.geometry ? parcelSamples(plot.geometry as PlotGeometry, 3) : [plot.centroid];
  let sourceId = "tinitaly", resolution = 10;
  const provenanceEntries = [];
  const results = await Promise.allSettled(samples.map(async (center) => {
    const payload = await fetchSource("tinitaly", wmsPointParams("tinitaly_dem", center, 0.00001), { signal, timeoutMs: 10_000, retries: 1 });
    return { center, elevation: parseTinitaly(jsonBody(payload)), provenance: provenance("tinitaly", payload) };
  }));
  let heights: HeightSample[] = results.flatMap((r) => r.status === "fulfilled" && r.value.elevation !== null ? [{ center: r.value.center, elevation: r.value.elevation }] : []);
  provenanceEntries.push(...results.flatMap((r) => r.status === "fulfilled" ? [r.value.provenance] : []));
  if (!heights.length && !signal.aborted) {
    const payload = await fetchSource("opentopodata", { locations: samples.map((p) => `${p.lat},${p.lon}`).join("|"), interpolation: "bilinear" }, { signal, timeoutMs: 10_000 });
    const parsed = TopoResponse.safeParse(jsonBody(payload));
    if (!parsed.success || parsed.data.results.length !== samples.length) throw new UpstreamError("Campioni EU-DEM non validi.");
    heights = parsed.data.results.flatMap((s) => s.elevation === null ? [] : [{ center: { lat: s.location.lat, lon: s.location.lng }, elevation: s.elevation }]);
    provenanceEntries.length = 0;
    provenanceEntries.push(provenance("opentopodata", payload));
    sourceId = "opentopodata"; resolution = 25;
  }
  const values = heights.map((h) => h.elevation), slope = estimateSlope(heights);
  const round = (n: number) => Math.round(n * 10) / 10;
  return layerResult("terrain", { status: values.length ? values.length === samples.length && slope !== null ? "ok" : "partial" : "empty", scope: plot.geometry ? "parcel" : "point", headline: values.length ? `I campioni del terreno hanno quote tra ${round(Math.min(...values))} e ${round(Math.max(...values))} metri.` : "La fonte non fornisce quote per i campioni del lotto.", severity: "none", metrics: [{ key: "elevation_min", label: "Quota minima dei campioni", value: values.length ? round(Math.min(...values)) : null, unit: "m" }, { key: "elevation_max", label: "Quota massima dei campioni", value: values.length ? round(Math.max(...values)) : null, unit: "m" }, { key: "elevation_mean", label: "Quota media dei campioni", value: values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null, unit: "m" }, { key: "slope_estimate", label: "Pendenza media stimata", value: slope === null ? null : round(slope), unit: "%" }, { key: "samples", label: "Campioni validi", value: heights.length, unit: "campioni" }, { key: "resolution", label: "Risoluzione del modello", value: resolution, unit: "m" }], features: { type: "FeatureCollection", features: heights.map((h) => ({ type: "Feature", geometry: { type: "Point", coordinates: [h.center.lon, h.center.lat] }, properties: { classKey: "elevation-sample", elevationM: round(h.elevation) } })) }, legend: [{ classKey: "elevation-sample", label: "Quota campionata nel DTM" }], notes: [`${sourceId === "tinitaly" ? "TINITALY 1.1, terreno nudo 10 m (2023)" : "Fallback EU-DEM 1.1, 25 m, hosting OpenTopoData"}: griglia 4×4 nella bbox, solo punti coperti dal poligono, più un punto interno; massimo 17 campioni. Minimo/massimo/media dei campioni, non di tutti i pixel del lotto.`, "Pendenza da regressione di un piano sui campioni in coordinate metriche locali: 100 × √(a²+b²). Non misura scarpate o pendenza massima; null per campioni insufficienti o collineari.", "La pendenza del WMS tinitaly_slope non viene usata perché la sua unità non è verificata. Quote da modello, non rilievo topografico.", ...(values.length < samples.length ? ["Alcuni campioni hanno NoData o non sono disponibili."] : [])], provenance: provenanceEntries });
};
