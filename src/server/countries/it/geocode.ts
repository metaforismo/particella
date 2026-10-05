import { z } from "zod";
import type { GeocodeResult } from "../../../lib/contracts/index.ts";
import { BadRequest, NotConfigured, UpstreamError } from "../../core/errors.ts";
import { jsonBody } from "../../core/http.ts";
import { source } from "../../core/sources.ts";
import { fetchSource } from "./queries.ts";

const Nominatim = z.array(
  z.object({
    place_id: z.number(),
    display_name: z.string(),
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    addresstype: z.string().optional(),
    boundingbox: z.array(z.coerce.number()).length(4).optional(),
  }),
);
export function parseNominatim(value: unknown): GeocodeResult[] {
  const parsed = Nominatim.safeParse(value);
  if (!parsed.success) throw new UpstreamError("Risposta Nominatim non valida.");
  return parsed.data.map((r) => ({
    id: `osm:${r.place_id}`,
    label: r.display_name.split(",")[0],
    secondary: r.display_name.split(",").slice(1).join(",").trim() || null,
    kind:
      r.addresstype === "house"
        ? "address"
        : r.addresstype === "road"
          ? "street"
          : r.addresstype === "city" || r.addresstype === "town" || r.addresstype === "village"
            ? "municipality"
            : "place",
    center: { lat: r.lat, lon: r.lon },
    bbox: r.boundingbox ? [r.boundingbox[2], r.boundingbox[0], r.boundingbox[3], r.boundingbox[1]] : null,
  }));
}
const Photon = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(
    z.object({
      geometry: z.object({
        type: z.literal("Point"),
        coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
      }),
      properties: z.object({
        osm_id: z.number(),
        osm_type: z.string(),
        name: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        type: z.string().optional(),
      }),
    }),
  ),
});
export function parsePhoton(value: unknown): GeocodeResult[] {
  const parsed = Photon.safeParse(value);
  if (!parsed.success) throw new UpstreamError("Risposta Photon non valida.");
  return parsed.data.features.map((f) => ({
    id: `photon:${f.properties.osm_type}:${f.properties.osm_id}`,
    label: f.properties.name ?? f.properties.city ?? "Luogo",
    secondary: [f.properties.city, f.properties.country].filter(Boolean).join(", ") || null,
    kind: "place",
    center: { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] },
    bbox: null,
  }));
}
export async function geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const q = query.trim().replace(/\s+/g, " ");
  if (/\bfoglio\s+\d+.*\bparticella\s+\d+/i.test(q))
    throw new BadRequest(
      "Per una ricerca catastale usare l'ID it:Belfiore:sezione:foglio:particella; la ricerca per nome del comune non è disponibile.",
    );
  if (
    process.env.NODE_ENV === "production" &&
    new URL(source("nominatim").endpoint).host === "nominatim.openstreetmap.org" &&
    process.env.PARTICELLA_SINGLE_INSTANCE !== "1"
  )
    throw new NotConfigured(
      "Configurare un geocoder proprio o un proxy con limite globale per usare Nominatim in produzione.",
    );
  try {
    const payload = await fetchSource(
      "nominatim",
      { q, format: "jsonv2", limit: 5, addressdetails: 1, countrycodes: "it" },
      { signal, ttlMs: 2_592_000_000, timeoutMs: 8000, retries: 1 },
    );
    const results = parseNominatim(jsonBody(payload));
    if (results.length) return results;
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  const fallback = await fetchSource(
    "photon",
    { q, limit: 5, lat: 42.5, lon: 12.5 },
    { signal, ttlMs: 2_592_000_000, timeoutMs: 8000, retries: 1 },
  );
  return parsePhoton(jsonBody(fallback));
}
