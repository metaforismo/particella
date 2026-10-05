import type { LayerProvider } from "../../../core/layers.ts";
import { layerResult } from "../../../core/layers.ts";
import { provenance } from "../../../core/provenance.ts";
import { http } from "../../../core/http.ts";
import { source } from "../../../core/sources.ts";
import { spatialRelation, type PlotGeometry } from "../../../geo/index.ts";
import { arcPointParams, parseGeo, queryUrl } from "../queries.ts";

const radiusM = 1000;
export const protectedAreas: LayerProvider = async (plot, { signal }) => {
  const requests = [0, 1, 2].map((id) => ({ sourceId: "natura2000", endpoint: `${source("natura2000").endpoint}/${id}/query`, classKey: "natura2000" }));
  requests.push({ sourceId: "natda", endpoint: source("natda").endpoint, classKey: "natda" });
  const polygon = plot.geometry as PlotGeometry | null;
  const geometryParams: Record<string, string> = polygon ? { geometry: JSON.stringify({ rings: (polygon.type === "Polygon" ? [polygon.coordinates] : polygon.coordinates).flat(), spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryPolygon" } : {};
  const results = await Promise.allSettled(requests.map(async ({ sourceId, endpoint, classKey }) => {
    const url = queryUrl(endpoint, { ...arcPointParams(plot.centroid), ...geometryParams, f: "geojson", outSR: 4326, returnGeometry: true, distance: radiusM, units: "esriSRUnit_Meter", resultRecordCount: 100 });
    const payload = await http.request(url, { signal, policy: source(sourceId).hostPolicy });
    const collection = parseGeo(payload);
    const features = collection.features.flatMap((f) => {
      if (f.geometry?.type !== "Polygon" && f.geometry?.type !== "MultiPolygon") return [];
      const relation = spatialRelation(f.geometry, polygon, plot.centroid);
      if (relation.distanceM > radiusM) return [];
      return [{ ...f, properties: { ...f.properties, classKey, relation: relation.relation, distanceM: Math.round(relation.distanceM), name: f.properties.SITENAME ?? f.properties.siteName ?? null, siteCode: f.properties.SITECODE ?? f.properties.nationalId ?? f.id ?? null } }];
    });
    return { features, provenance: provenance(sourceId, payload) };
  }));
  const answered = results.flatMap((r) => r.status === "fulfilled" ? [r.value] : []);
  const features = [...new Map(answered.flatMap((a) => a.features).map((f) => [`${f.properties.classKey}:${f.properties.siteCode}`, f])).values()];
  const intersecting = features.filter((f) => f.properties.relation !== "nearby");
  const complete = answered.length === 4;
  return layerResult("protected-areas", { status: complete ? features.length ? "ok" : "empty" : answered.length ? "partial" : "unavailable", scope: polygon ? "parcel" : "buffer", headline: intersecting.length ? "Il lotto incontra un'area protetta presente nei dati europei." : features.length ? "Sono presenti aree protette entro un chilometro dal lotto." : complete ? "I dati europei non restituiscono aree protette entro un chilometro." : "I dati sulle aree protette sono disponibili solo in parte.", severity: intersecting.length ? "medium" : features.length ? "low" : "unknown", metrics: [{ key: "intersecting_sites", label: "Aree che contengono o intersecano il lotto", value: intersecting.length, unit: "aree" }, { key: "nearby_sites", label: "Aree vicine senza intersezione", value: features.length - intersecting.length, unit: "aree" }, { key: "search_radius", label: "Distanza massima di ricerca dal lotto", value: radiusM, unit: "m" }], features: { type: "FeatureCollection", features }, legend: [{ classKey: "natura2000", label: "Natura 2000" }, { classKey: "natda", label: "Area protetta nazionale (NatDA / EUAP)" }], notes: ["Relazioni contains/intersects/nearby calcolate sulle geometrie EEA; distanza minima tra vertici e segmenti geodetici, approssimata. Nessuna percentuale di sovrapposizione è stimata.", "La vicinanza non implica un vincolo sul lotto; per gli effetti consultare gli atti e il piano del gestore.", "NatDA è distinto da Natura 2000. I dataset europei non escludono altre tutele nazionali o regionali."], provenance: answered.map((a) => a.provenance) });
};
