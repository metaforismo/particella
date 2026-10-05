import { z } from "zod";
import type { LatLon } from "../../../../lib/contracts/index.ts";
import type { LayerProvider } from "../../../core/layers.ts";
import { layerResult } from "../../../core/layers.ts";
import { provenance } from "../../../core/provenance.ts";
import { jsonBody } from "../../../core/http.ts";
import { NotConfigured, UpstreamError } from "../../../core/errors.ts";
import { source } from "../../../core/sources.ts";
import { meters } from "../../../geo/index.ts";
import { fetchSource } from "../queries.ts";

export const categories = {
  schools: "Scuole",
  transit: "Fermate TPL",
  health: "Sanità e farmacie",
  supermarkets: "Supermercati",
  parks: "Parchi",
} as const;
type Category = keyof typeof categories;
export function serviceCategory(tags: Record<string, string>): Category | null {
  if (["school", "kindergarten", "college", "university"].includes(tags.amenity)) return "schools";
  if (["hospital", "clinic", "doctors", "pharmacy"].includes(tags.amenity)) return "health";
  if (tags.shop === "supermarket") return "supermarkets";
  if (tags.leisure === "park") return "parks";
  if (
    ["platform", "stop_position"].includes(tags.public_transport) ||
    tags.highway === "bus_stop" ||
    ["tram_stop", "station", "halt"].includes(tags.railway)
  )
    return "transit";
  return null;
}
const coordinate = { lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) };
const Overpass = z.object({
  osm3s: z.object({ timestamp_osm_base: z.string() }),
  remark: z.string().optional(),
  elements: z.array(
    z.object({
      type: z.enum(["node", "way", "relation"]),
      id: z.number(),
      lat: coordinate.lat.optional(),
      lon: coordinate.lon.optional(),
      center: z.object(coordinate).optional(),
      tags: z.record(z.string(), z.string()).optional(),
    }),
  ),
});
export function parseServices(value: unknown, center: LatLon) {
  const result = Overpass.safeParse(value);
  if (!result.success || result.data.remark)
    throw new UpstreamError("Overpass ha restituito un errore o una query incompleta.");
  const features = result.data.elements.flatMap((e) => {
    const tags = e.tags ?? {},
      classKey = serviceCategory(tags);
    const p = e.center ?? (e.lat !== undefined && e.lon !== undefined ? { lat: e.lat, lon: e.lon } : null);
    if (!classKey || !p) return [];
    const distanceM = meters(center, p);
    if (distanceM > 1000) return [];
    return [
      {
        type: "Feature" as const,
        id: `${e.type}/${e.id}`,
        geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
        properties: {
          classKey,
          name: tags.name ?? null,
          distanceM: Math.round(distanceM),
          exactDistanceM: distanceM,
          osmId: `${e.type}/${e.id}`,
          locationMethod: e.type === "node" ? "node" : "bbox_center",
        },
      },
    ];
  });
  return {
    features: [...new Map(features.map((f) => [f.id, f])).values()],
    referenceDate: result.data.osm3s.timestamp_osm_base,
  };
}
export const services: LayerProvider = async (plot, { signal }) => {
  if (
    process.env.NODE_ENV === "production" &&
    new URL(source("overpass").endpoint).host === "overpass-api.de"
  )
    throw new NotConfigured(
      "Configurare OVERPASS_URL con hosting proprio o un provider compatibile con l’uso commerciale.",
    );
  const around = `around:1000,${plot.centroid.lat},${plot.centroid.lon}`;
  const query = `[out:json][timeout:20];(nwr(${around})[amenity~"^(school|kindergarten|college|university|hospital|clinic|doctors|pharmacy)$"];nwr(${around})[public_transport~"^(platform|stop_position)$"];nwr(${around})[highway=bus_stop];nwr(${around})[railway~"^(tram_stop|station|halt)$"];nwr(${around})[shop=supermarket];nwr(${around})[leisure=park];);out center tags;`;
  const payload = await fetchSource("overpass", { data: query }, { signal, timeoutMs: 23_000, retries: 1 });
  const data = parseServices(jsonBody(payload), plot.centroid);
  return layerResult("services", {
    status: data.features.length ? "ok" : "empty",
    scope: "buffer",
    headline: data.features.length
      ? `OpenStreetMap registra ${data.features.length} servizi e luoghi utili entro un chilometro.`
      : "OpenStreetMap non restituisce servizi delle categorie cercate entro un chilometro.",
    severity: "none",
    metrics: Object.entries(categories).flatMap(([key, label]) => {
      const features = data.features.filter((f) => f.properties.classKey === key);
      return [
        {
          key: `${key}_500m`,
          label: `${label} entro 500 m`,
          value: features.filter((f) => f.properties.exactDistanceM <= 500).length,
          unit: "luoghi",
        },
        { key: `${key}_1000m`, label: `${label} entro 1 km`, value: features.length, unit: "luoghi" },
        {
          key: `${key}_nearest`,
          label: `${label}: distanza del più vicino entro 1 km`,
          value: features.length ? Math.min(...features.map((f) => f.properties.distanceM)) : null,
          unit: "m",
        },
      ];
    }),
    features: { type: "FeatureCollection", features: data.features },
    legend: Object.entries(categories).map(([classKey, label]) => ({ classKey, label })),
    notes: [
      "Dati collaborativi OpenStreetMap, non elenco ufficiale né completo; servizi mancanti non significano assenza reale.",
      "Distanze in linea d'aria dal punto rappresentativo del lotto; per way/relation si usa il centro della bbox, non l'ingresso. Fermate e piattaforme possono rappresentare lo stesso luogo: nessuna deduplicazione per nome è applicata.",
      "Attribuzione © OpenStreetMap contributors; dati ODbL 1.0. Per carico stabile configurare un proprio Overpass o un provider con accordo.",
    ],
    provenance: [provenance("overpass", payload, { referenceDate: data.referenceDate })],
  });
};
