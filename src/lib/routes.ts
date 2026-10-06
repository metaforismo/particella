import type { GeocodeResult, LatLon } from "@/lib/contracts";

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

function withAt(path: string, at?: PlotLocation) {
  const value = at ? ("lat" in at ? formatAt(at) : at.map((p) => `${p.lat},${p.lon}`).join(";")) : undefined;
  return value ? `${path}?at=${value}` : path;
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
