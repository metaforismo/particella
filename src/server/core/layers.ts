import {
  LayerResult as ResultSchema,
  type LayerResult,
  type LayerCatalogEntry,
  type LayerId,
  type Plot,
  type MapOverlay,
} from "#contracts";
import { BackendError, NotConfigured, OutsideCoverage, UpstreamError } from "#server/core/errors.ts";
import { cache, canonicalKey, NEGATIVE_TTL_MS } from "#server/core/cache.ts";
import { hash } from "#server/core/http.ts";

export interface LayerContext {
  signal: AbortSignal;
  /** How long this run may wait in total; providers size their upstream timeouts from it. */
  timeoutMs?: number;
}

export type LayerProvider = (plot: Plot, context: LayerContext) => Promise<LayerResult>;

export const layerCatalog: LayerCatalogEntry[] = [
  {
    id: "power-grid",
    group: "energia",
    title: "Rete elettrica vicina",
    description: "Distanze geometriche da linee ≥132 kV e stazioni OSM entro 10 km",
    sourceIds: ["overpass"],
  },
  {
    id: "infrastructure-distances",
    group: "urbanistica",
    title: "Distanze dalle infrastrutture",
    description: "Distanze da strade principali, ferrovie, cimiteri e pozzi OSM entro 2 km",
    sourceIds: ["overpass"],
  },
  {
    id: "industrial-sites",
    group: "energia",
    title: "Aree industriali, cave e discariche",
    description: "Aree censite in OpenStreetMap entro 2 km, senza classificazione legale",
    sourceIds: ["overpass"],
  },
  {
    id: "regional-land-cover",
    group: "urbanistica",
    title: "Uso del suolo regionale",
    description: "Classe UCS Toscana 2019 o DUSAF Lombardia 2021 sul punto",
    sourceIds: ["toscana-ucs", "lombardia-dusaf"],
  },
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
  {
    id: "landscape",
    group: "urbanistica",
    title: "Paesaggio",
    description: "Tutele paesaggistiche SITAP sul punto",
    sourceIds: ["sitap"],
  },
  {
    id: "planning",
    group: "urbanistica",
    title: "Urbanistica",
    description: "PO Firenze/Siena, PRG Torino e mosaici regionali Lombardia/Veneto",
    sourceIds: [
      "planning-firenze",
      "planning-milano",
      "planning-lombardia",
      "planning-torino",
      "planning-siena",
      "planning-veneto",
      "planning-veneto-legend",
    ],
  },
  {
    id: "land-cover",
    group: "urbanistica",
    title: "Copertura del suolo",
    description: "Copertura prevalente stimata da CORINE 2018",
    sourceIds: ["corine"],
  },
  {
    id: "accessibility",
    group: "contesto",
    title: "Accessibilità",
    description: "Aree raggiungibili in 10 minuti a piedi e in auto",
    sourceIds: ["valhalla", "overpass"],
  },
  {
    id: "market",
    group: "contesto",
    title: "Mercato immobiliare",
    description: "Zona OMI e intervalli residenziali dell’ultimo semestre",
    sourceIds: ["omi"],
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
    status:
      error instanceof OutsideCoverage || error instanceof NotConfigured ? "outside_coverage" : "unavailable",
    headline:
      error instanceof NotConfigured
        ? "Questo livello non è ancora collegato per questo servizio."
        : error instanceof OutsideCoverage
          ? "La fonte non copre questo luogo."
          : "La fonte non è al momento disponibile.",
    method: error instanceof BackendError ? error.message : undefined,
    notes: ["I dati mancanti non equivalgono all'assenza di fenomeni."],
  });
}

const pending = new Map<string, Promise<LayerResult>>();

/** Bounds waiting, including provider queues; a timeout is unavailable, never an empty finding. */
export function layerTimeoutMs(layer: LayerId): number {
  return ["power-grid", "infrastructure-distances", "industrial-sites", "services", "accessibility"].includes(
    layer,
  )
    ? 6000
    : 6500;
}

/**
 * A single layer requested on its own (the Studio loads them one by one) can wait longer than a
 * layer inside a full report, where one slow source must not hold the whole page.
 */
export function singleLayerTimeoutMs(layer: LayerId): number {
  return layerTimeoutMs(layer) <= 6000 ? 20_000 : 15_000;
}

export async function runLayer(
  layer: LayerId,
  plot: Plot,
  provider?: LayerProvider,
  timeoutMs = layerTimeoutMs(layer),
): Promise<LayerResult> {
  if (!provider)
    return layerResult(layer, {
      status: "outside_coverage",
      headline: "Questo livello non è ancora collegato per questo luogo.",
      notes: ["Consultare l’ente competente per queste informazioni."],
    });
  const key = canonicalKey("layer:v2", {
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
      resolve(failedLayer(layer, new UpstreamError("Tempo massimo di attesa del livello superato.")));
    }, timeoutMs);
  });
  const task = Promise.race([
    Promise.resolve()
      .then(() => provider(plot, { signal: controller.signal, timeoutMs }))
      .then((r) =>
        ResultSchema.parse(
          plot.parcels
            ? {
                ...r,
                notes: [
                  ...r.notes,
                  r.scope === "parcel"
                    ? "Analisi sulla geometria unita del lotto composto."
                    : r.scope === "municipality"
                      ? "Lotto composto: valori del Comune condiviso dalle particelle."
                      : r.scope === "buffer"
                        ? "Lotto composto: analisi nel buffer dichiarato dal livello; distanze e relazioni usano la geometria unita quando prevista dal metodo."
                        : `Lotto composto: i dati con ambito ${r.scope} usano il punto interno dichiarato (${plot.centroid.lat}, ${plot.centroid.lon}); non descrivono tutte le particelle.`,
                ],
              }
            : r,
        ),
      )
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
