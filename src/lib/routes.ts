import type { GeocodeResult } from "@/lib/contracts";

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

export function reportHref(plotId: string) {
  return `/scheda/${encodeURIComponent(plotId)}`;
}
