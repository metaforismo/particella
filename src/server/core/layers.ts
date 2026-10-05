import {
  LayerResult as ResultSchema,
  type LayerResult,
  type LayerCatalogEntry,
  type LayerId,
  type Plot,
  type MapOverlay,
} from "../../lib/contracts/index.ts";
import { NotConfigured, OutsideCoverage } from "./errors.ts";
import { cache, canonicalKey, NEGATIVE_TTL_MS } from "./cache.ts";
import { hash } from "./http.ts";

export interface LayerContext {
  signal: AbortSignal;
}
export type LayerProvider = (plot: Plot, context: LayerContext) => Promise<LayerResult>;
export const layerCatalog: LayerCatalogEntry[] = [
  {
    id: "flood",
    group: "rischi",
    title: "Alluvioni",
    description: "Scenari idraulici PAI sul punto selezionato",
    sourceIds: ["idrogeo"],
  },
  {
    id: "landslide",
    group: "rischi",
    title: "Frane",
    description: "Pericolosità PAI e inventario IFFI sul punto",
    sourceIds: ["idrogeo", "iffi"],
  },
  {
    id: "seismic",
    group: "rischi",
    title: "Sismicità",
    description: "Zona comunale DPC e PGA del nodo MPS04 più vicino",
    sourceIds: ["dpc-seismic", "ingv-pga"],
  },
  {
    id: "protected-areas",
    group: "ambiente",
    title: "Aree protette",
    description: "Natura 2000 e aree protette nazionali entro 1 km dal lotto",
    sourceIds: ["natura2000", "natda"],
  },
  {
    id: "terrain",
    group: "ambiente",
    title: "Terreno",
    description: "Quote campionate e pendenza stimata da DTM",
    sourceIds: ["tinitaly", "opentopodata"],
  },
  {
    id: "solar",
    group: "ambiente",
    title: "Sole",
    description: "Irraggiamento e produzione simulata di 1 kWp con PVGIS",
    sourceIds: ["pvgis"],
  },
  {
    id: "services",
    group: "contesto",
    title: "Servizi vicini",
    description: "Servizi OpenStreetMap entro 500 m e 1 km",
    sourceIds: ["overpass"],
  },
  {
    id: "demographics",
    group: "contesto",
    title: "Popolazione",
    description: "Residenti della cella censuaria di 1 km² nel 2021",
    sourceIds: ["istat-grid", "istat-population"],
  },
];
export function layerResult(
  layer: LayerId,
  values: Partial<Omit<LayerResult, "layer" | "group" | "title" | "computedAt">>,
): LayerResult {
  const catalog = layerCatalog.find((entry) => entry.id === layer);
  return ResultSchema.parse({
    layer,
    group: catalog?.group ?? "contesto",
    title: catalog?.title ?? layer,
    status: "ok",
    scope: "point",
    headline: "Dati disponibili.",
    severity: "unknown",
    metrics: [],
    features: null,
    overlays: [],
    legend: [],
    notes: [],
    provenance: [],
    ...values,
    computedAt: new Date().toISOString(),
  });
}
export function failedLayer(layer: LayerId, error: unknown): LayerResult {
  return layerResult(layer, {
    status: error instanceof OutsideCoverage ? "outside_coverage" : "unavailable",
    headline:
      error instanceof OutsideCoverage
        ? "La fonte non copre questo luogo."
        : "La fonte non è al momento disponibile.",
    notes: [
      "I dati mancanti non equivalgono all'assenza di fenomeni.",
      ...(error instanceof NotConfigured ? [error.message] : []),
    ],
  });
}
const pending = new Map<string, Promise<LayerResult>>();
export async function runLayer(
  layer: LayerId,
  plot: Plot,
  provider?: LayerProvider,
  timeoutMs = 25_000,
): Promise<LayerResult> {
  if (!provider)
    return layerResult(layer, {
      status: "unavailable",
      headline: "Questo livello non è ancora disponibile.",
      notes: ["Provider previsto nella prossima fase."],
    });
  const key = canonicalKey("layer:v1", {
    layer,
    id: plot.id,
    geometry: hash(plot.geometry),
    center: plot.centroid,
    municipality: plot.municipality?.istatCode,
  });
  const stored = await cache.get<LayerResult>(key);
  if (stored) return stored;
  const existing = pending.get(key);
  if (existing) return existing;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<LayerResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(failedLayer(layer, new Error("timeout")));
    }, timeoutMs);
  });
  const task = Promise.race([
    Promise.resolve()
      .then(() => provider(plot, { signal: controller.signal }))
      .then((r) => ResultSchema.parse(r))
      .catch((error: unknown) => failedLayer(layer, error)),
    deadline,
  ])
    .then(async (result) => {
      clearTimeout(timer);
      const negative = ["unavailable", "error", "partial"].includes(result.status);
      await cache.set(key, result, negative ? NEGATIVE_TTL_MS : 86_400_000);
      return result;
    })
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, task);
  return task;
}
export function overlay(id: string, attribution: string, opacity = 0.5): MapOverlay {
  return { id, kind: "raster", tileUrl: `/api/v1/tiles/${id}/{z}/{x}/{y}`, opacity, attribution };
}
