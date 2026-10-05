/**
 * Shared API contract between the Studio UI and the `/api/v1` route handlers.
 * Every payload that crosses the network is described here and validated with zod
 * on the server boundary. Change this file first, then both sides.
 */
import { z } from "zod";

/** Only web links ever reach an href: blocks `javascript:` and friends coming from upstream data. */
const WebUrl = z.url({ protocol: /^https?$/ });

export const CountryCode = z.enum(["it"]);
export type CountryCode = z.infer<typeof CountryCode>;

export const LatLon = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type LatLon = z.infer<typeof LatLon>;

/** Where a value comes from. Shown next to every number in the UI. */
export const Provenance = z.object({
  sourceId: z.string(),
  dataset: z.string(),
  authority: z.string(),
  license: z.string(),
  url: WebUrl,
  method: z.enum(["api", "wms", "wfs", "snapshot", "computed"]),
  isOfficial: z.boolean(),
  /** The exact request we made, without secrets, so anyone can repeat it. */
  requestUrl: z.string().nullable().optional(),
  retrievedAt: z.iso.datetime(),
  /** Reference date of the data itself, when the publisher declares it. */
  referenceDate: z.string().nullable().optional(),
});
export type Provenance = z.infer<typeof Provenance>;

export const GeocodeResult = z.object({
  id: z.string(),
  label: z.string(),
  secondary: z.string().nullable(),
  kind: z.enum(["address", "street", "place", "municipality", "parcel"]),
  center: LatLon,
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
});
export type GeocodeResult = z.infer<typeof GeocodeResult>;

export const Municipality = z.object({
  istatCode: z.string(),
  /** Codice catastale (Belfiore), e.g. F205 for Milano. */
  cadastralCode: z.string().nullable(),
  name: z.string(),
  province: z.string().nullable(),
  provinceCode: z.string().nullable(),
  region: z.string().nullable(),
});
export type Municipality = z.infer<typeof Municipality>;

const Geometry = z.object({
  type: z.enum(["Polygon", "MultiPolygon"]),
  coordinates: z.array(z.any()),
});

export const Plot = z.object({
  /** Stable id: `it:<belfiore>:<sezione|_>:<foglio>:<particella>`. */
  id: z.string(),
  country: CountryCode,
  cadastral: z.object({
    municipalityCode: z.string(),
    section: z.string().nullable(),
    sheet: z.string(),
    parcel: z.string(),
    /** Human label, e.g. "Foglio 388 · Particella 112". */
    label: z.string(),
  }),
  municipality: Municipality.nullable(),
  address: z.string().nullable(),
  centroid: LatLon,
  geometry: Geometry.nullable(),
  areaM2: z.number().nullable(),
  perimeterM: z.number().nullable(),
  provenance: z.array(Provenance),
});
export type Plot = z.infer<typeof Plot>;

export const LayerId = z.enum([
  "terrain",
  "flood",
  "landslide",
  "seismic",
  "protected-areas",
  "landscape",
  "planning",
  "land-cover",
  "solar",
  "services",
  "accessibility",
  "demographics",
  "market",
]);
export type LayerId = z.infer<typeof LayerId>;

export const LayerGroup = z.enum(["urbanistica", "rischi", "ambiente", "contesto"]);
export type LayerGroup = z.infer<typeof LayerGroup>;

/** How much a layer should worry the reader. `unknown` means data was missing, not zero. */
export const Severity = z.enum(["none", "low", "medium", "high", "unknown"]);
export type Severity = z.infer<typeof Severity>;

export const Metric = z.object({
  key: z.string(),
  label: z.string(),
  value: z.union([z.number(), z.string(), z.null()]),
  unit: z.string().nullable().optional(),
  hint: z.string().nullable().optional(),
});
export type Metric = z.infer<typeof Metric>;

/** Raster overlay the map can draw. `tileUrl` is a MapLibre template served by our proxy. */
export const MapOverlay = z.object({
  id: z.string(),
  kind: z.literal("raster"),
  /** Must point at our own tile proxy; third-party tile hosts are never passed through. */
  tileUrl: z.string().startsWith("/api/v1/tiles/"),
  opacity: z.number().min(0).max(1),
  attribution: z.string(),
});
export type MapOverlay = z.infer<typeof MapOverlay>;

export const LegendItem = z.object({
  /** Stable class key; the UI owns the colour for each `layer:classKey`. */
  classKey: z.string(),
  label: z.string(),
});
export type LegendItem = z.infer<typeof LegendItem>;

export const LayerResult = z.object({
  layer: LayerId,
  group: LayerGroup,
  title: z.string(),
  /**
   * ok: answered. empty: the source answered and has nothing here (not the same as "safe").
   * outside_coverage: the source does not cover this place. unavailable: the source failed.
   */
  status: z.enum(["ok", "empty", "partial", "outside_coverage", "unavailable", "error"]),
  /** What the value describes, so a municipality figure is never read as a plot figure. */
  scope: z.enum(["parcel", "point", "buffer", "grid_cell", "municipality", "zone"]),
  /** One plain-Italian sentence a non-expert can act on. */
  headline: z.string(),
  severity: Severity,
  metrics: z.array(Metric),
  /** Vector features to draw; each feature carries `properties.classKey`. */
  features: z
    .object({ type: z.literal("FeatureCollection"), features: z.array(z.any()) })
    .nullable(),
  overlays: z.array(MapOverlay),
  legend: z.array(LegendItem),
  notes: z.array(z.string()),
  provenance: z.array(Provenance),
  computedAt: z.iso.datetime(),
});
export type LayerResult = z.infer<typeof LayerResult>;

export const LayerCatalogEntry = z.object({
  id: LayerId,
  group: LayerGroup,
  title: z.string(),
  description: z.string(),
  sourceIds: z.array(z.string()),
});
export type LayerCatalogEntry = z.infer<typeof LayerCatalogEntry>;

export const SourceCatalogEntry = z.object({
  id: z.string(),
  name: z.string(),
  authority: z.string(),
  license: z.string(),
  url: WebUrl,
  coverage: z.string(),
  updateCadence: z.string().nullable(),
});
export type SourceCatalogEntry = z.infer<typeof SourceCatalogEntry>;

export const PlotReport = z.object({
  plot: Plot,
  layers: z.array(LayerResult),
  generatedAt: z.iso.datetime(),
});
export type PlotReport = z.infer<typeof PlotReport>;

export const ApiError = z.object({
  error: z.object({
    code: z.enum([
      "bad_request",
      "not_found",
      "upstream_unavailable",
      "rate_limited",
      "not_configured",
      "internal",
    ]),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;
