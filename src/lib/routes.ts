import type { GeocodeResult, LatLon, Plot } from "@/lib/contracts";

/**
 * A plot is addressed by its cadastral id plus a point inside it (one per parcel for composite lots).
 * The cadastre cannot be queried reliably by id alone, so the points let any server instance
 * re-resolve the parcels spatially without rebuilding the cadastral index.
 */
export function formatAt(point: LatLon) {
  return `${point.lat.toFixed(6)},${point.lon.toFixed(6)}`;
}

export function parseAt(value: string | null | undefined): LatLon | undefined {
  const match = value?.match(/^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return undefined;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : undefined;
}

export type PlotLocation = LatLon | readonly LatLon[];

/** Where to re-resolve a plot: its inner point, or one point per parcel (in id order) for a lot. */
export function plotLocation(plot: Pick<Plot, "centroid" | "parcels">): PlotLocation {
  return plot.parcels?.length ? plot.parcels.map((p) => p.at) : plot.centroid;
}

export function formatLocation(at: PlotLocation) {
  return "lat" in at ? formatAt(at) : at.map(formatAt).join(";");
}

/** Accepts `lat,lon` or `lat,lon;lat,lon;…`; anything malformed is dropped as a whole. */
export function parseLocation(value: string | null | undefined): PlotLocation | undefined {
  const parts = value?.split(";") ?? [];
  if (parts.length === 0 || parts.length > 20) return undefined;
  const points = parts.map(parseAt);
  if (points.some((p) => !p)) return undefined;
  return points.length === 1 ? points[0] : (points as LatLon[]);
}

function withAt(path: string, at?: PlotLocation) {
  return at ? `${path}?at=${formatLocation(at)}` : path;
}

/** Deep link into the Studio for a picked place or a free-text query. */
export function studioHref(place: GeocodeResult | { query: string }) {
  const params = new URLSearchParams();
  if ("query" in place) {
    params.set("q", place.query);
  } else {
    params.set("lat", place.center.lat.toFixed(6));
    params.set("lon", place.center.lon.toFixed(6));
    params.set("q", place.label);
  }
  return `/studio?${params}`;
}

export function reportHref(plotId: string, at?: PlotLocation) {
  return withAt(`/scheda/${encodeURIComponent(plotId)}`, at);
}

export function plotApiPath(plotId: string, suffix = "", at?: PlotLocation) {
  return withAt(`/api/v1/plots/${encodeURIComponent(plotId)}${suffix}`, at);
}
