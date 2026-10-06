import { formatNumber } from "#server/core/format.ts";
import { z } from "zod";
import type { LayerProvider } from "#server/core/layers.ts";
import { layerResult } from "#server/core/layers.ts";
import { provenance } from "#server/core/provenance.ts";
import { jsonBody } from "#server/core/http.ts";
import { UpstreamError } from "#server/core/errors.ts";
import { parcelSamples, type PlotGeometry } from "#server/geo/index.ts";
import { estimateSlope, estimateAspect, type HeightSample } from "#server/geo/terrain.ts";
import { fetchSource, wmsPointParams } from "#server/countries/it/queries.ts";

const TinResponse = z.object({
  features: z.array(z.object({ properties: z.object({ GRAY_INDEX: z.number().nullable() }) })),
});

export function parseTinitaly(value: unknown): number | null {
  const result = TinResponse.safeParse(value);
  if (!result.success) throw new UpstreamError("Quota TINITALY non valida.");
  if (!result.data.features.length) return null;
  if (result.data.features.length !== 1) throw new UpstreamError("Quota TINITALY ambigua.");
  const height = result.data.features[0].properties.GRAY_INDEX;
  return height === null || height <= -9999 ? null : height;
}

const TopoResponse = z.object({
  status: z.literal("OK"),
  results: z.array(
    z.object({
      elevation: z.number().nullable(),
      location: z.object({ lat: z.number(), lng: z.number() }),
      dataset: z.literal("eudem25m"),
    }),
  ),
});

export const terrain: LayerProvider = async (plot, { signal }) => {
  const samples = plot.geometry ? parcelSamples(plot.geometry as PlotGeometry, 3) : [plot.centroid];
  let sourceId = "tinitaly";
  let resolution = 10;
  const provenanceEntries = [];
  const results = await Promise.allSettled(
    samples.map(async (center) => {
      const payload = await fetchSource("tinitaly", wmsPointParams("tinitaly_dem", center, 0.00001), {
        signal,
        timeoutMs: 10_000,
        retries: 1,
      });
      return {
        center,
        elevation: parseTinitaly(jsonBody(payload)),
        provenance: provenance("tinitaly", payload),
      };
    }),
  );
  let heights: HeightSample[] = results.flatMap((r) =>
    r.status === "fulfilled" && r.value.elevation !== null
      ? [{ center: r.value.center, elevation: r.value.elevation }]
      : [],
  );
  provenanceEntries.push(...results.flatMap((r) => (r.status === "fulfilled" ? [r.value.provenance] : [])));
  if (!heights.length && !signal.aborted) {
    const payload = await fetchSource(
      "opentopodata",
      { locations: samples.map((p) => `${p.lat},${p.lon}`).join("|"), interpolation: "bilinear" },
      { signal, timeoutMs: 10_000 },
    );
    const parsed = TopoResponse.safeParse(jsonBody(payload));
    if (!parsed.success || parsed.data.results.length !== samples.length)
      throw new UpstreamError("Campioni EU-DEM non validi.");
    heights = parsed.data.results.flatMap((s) =>
      s.elevation === null
        ? []
        : [{ center: { lat: s.location.lat, lon: s.location.lng }, elevation: s.elevation }],
    );
    provenanceEntries.length = 0;
    provenanceEntries.push(provenance("opentopodata", payload));
    sourceId = "opentopodata";
    resolution = 25;
  }
  const values = heights.map((h) => h.elevation);
  const slope = estimateSlope(heights);
  const aspect = estimateAspect(heights);
  const round = (n: number) => Math.round(n * 10) / 10;
  return layerResult("terrain", {
    status: values.length ? (values.length === samples.length && slope !== null ? "ok" : "partial") : "empty",
    scope: plot.geometry ? "parcel" : "point",
    headline: values.length
      ? `I campioni del terreno hanno quote tra ${formatNumber(round(Math.min(...values)))} e ${formatNumber(round(Math.max(...values)))} metri.`
      : "La fonte non fornisce quote per i campioni del lotto.",
    severity: "none",
    metrics: [
      {
        key: "elevation_min",
        label: "Quota minima dei campioni",
        value: values.length ? round(Math.min(...values)) : null,
        unit: "m",
      },
      {
        key: "elevation_max",
        label: "Quota massima dei campioni",
        value: values.length ? round(Math.max(...values)) : null,
        unit: "m",
      },
      {
        key: "elevation_mean",
        label: "Quota media dei campioni",
        value: values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null,
        unit: "m",
      },
      {
        key: "slope_estimate",
        label: "Pendenza media stimata",
        value: slope === null ? null : round(slope),
        unit: "%",
      },
      { key: "samples", label: "Campioni validi", value: heights.length, unit: "campioni" },
      { key: "resolution", label: "Risoluzione del modello", value: resolution, unit: "m" },
      {
        key: "aspect_estimate",
        label: "Orientamento medio stimato della discesa",
        value: aspect === null ? null : round(aspect),
        unit: "°",
        hint: "0° nord, 90° est, 180° sud, 270° ovest; non è l’orientamento dei pannelli.",
      },
      {
        key: "south_facing_share",
        label: "Superficie del lotto rivolta a sud",
        value: null,
        unit: "%",
        hint: "Il campionamento attuale non permette di calcolare una quota di superficie affidabile.",
      },
    ],
    features: {
      type: "FeatureCollection",
      features: heights.map((h) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [h.center.lon, h.center.lat] },
        properties: { classKey: "elevation-sample", elevationM: round(h.elevation) },
      })),
    },
    legend: [{ classKey: "elevation-sample", label: "Quota campionata nel DTM" }],
    method: `${sourceId === "tinitaly" ? "TINITALY 1.1 DTM 10 m (2023)" : "EU-DEM 1.1 25 m, OpenTopoData"}; griglia 4×4 nella bbox con punti interni e punto rappresentativo, massimo 17 campioni. Piano z=a·est+b·nord+c ai minimi quadrati; pendenza 100 × √(a²+b²); aspect (atan2(-a,-b)·180/π+360)%360. Aspect null sotto 0,5% di pendenza, e campioni insufficienti/collineari. Unità tinitaly_slope non verificata: layer non usato. Nessuna percentuale areale ricavata dal piano medio.`,
    notes: [
      "Le quote e la pendenza sono stime da una mappa, non un rilievo sul posto.",
      "Minimo e massimo riguardano i punti controllati: possono non cogliere scarpate o dislivelli piccoli.",
      "L’orientamento è una stima media della discesa del terreno. Non misura quanta superficie è rivolta a sud né l’orientamento dei pannelli; sui terreni quasi piani non viene indicato.",
      ...(!plot.geometry ? ["Senza il confine del terreno la pendenza non è stimabile."] : []),
      ...(values.length < samples.length ? ["Mancano le quote di alcuni punti."] : []),
    ],
    provenance: provenanceEntries,
  });
};
