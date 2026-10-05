import type { LayerProvider } from "#server/core/layers.ts";
import { layerResult } from "#server/core/layers.ts";
import { provenance } from "#server/core/provenance.ts";
import { http } from "#server/core/http.ts";
import { source } from "#server/core/sources.ts";
import { UpstreamError } from "#server/core/errors.ts";
import { spatialRelation, esriRings, type PlotGeometry } from "#server/geo/index.ts";
import { arcPointParams, parseGeo, queryUrl } from "#server/countries/it/queries.ts";

const radiusM = 1000;

export const protectedAreas: LayerProvider = async (plot, { signal }) => {
  const requests = [0, 1, 2].map((id) => ({
    sourceId: "natura2000",
    endpoint: `${source("natura2000").endpoint}/${id}/query`,
    classKey: "natura2000",
  }));
  requests.push({ sourceId: "natda", endpoint: source("natda").endpoint, classKey: "natda" });
  const polygon = plot.geometry as PlotGeometry | null;
  const geometryParams: Record<string, string> = polygon
    ? {
        geometry: JSON.stringify({
          rings: esriRings(polygon),
          spatialReference: { wkid: 4326 },
        }),
        geometryType: "esriGeometryPolygon",
      }
    : {};
  const results = await Promise.allSettled(
    requests.map(async ({ sourceId, endpoint, classKey }) => {
      const url = queryUrl(endpoint, {
        ...arcPointParams(plot.centroid),
        ...geometryParams,
        f: "geojson",
        outSR: 4326,
        returnGeometry: true,
        distance: radiusM,
        units: "esriSRUnit_Meter",
        resultRecordCount: 100,
      });
      const payload = await http.request(url, { signal, policy: source(sourceId).hostPolicy });
      const collection = parseGeo(payload);
      const features = collection.features.flatMap((f) => {
        if (f.geometry?.type !== "Polygon" && f.geometry?.type !== "MultiPolygon")
          throw new UpstreamError("Geometria di area protetta mancante o non valida.");
        const relation = spatialRelation(f.geometry, polygon, plot.centroid);
        if (relation.distanceM > radiusM) return [];
        return [
          {
            ...f,
            properties: {
              ...f.properties,
              classKey,
              relation: relation.relation,
              distanceM: Math.round(relation.distanceM),
              name: f.properties.SITENAME ?? f.properties.siteName ?? null,
              siteCode: f.properties.SITECODE ?? f.properties.nationalId ?? f.id ?? null,
            },
          },
        ];
      });
      return { features, provenance: provenance(sourceId, payload) };
    }),
  );
  const answered = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const features = [
    ...new Map(
      answered
        .flatMap((a) => a.features)
        .map((f) => [`${f.properties.classKey}:${f.properties.siteCode}`, f]),
    ).values(),
  ];
  const intersecting = features.filter((f) => f.properties.relation !== "nearby");
  const complete = answered.length === 4;
  return layerResult("protected-areas", {
    status: complete ? (features.length ? "ok" : "empty") : answered.length ? "partial" : "unavailable",
    scope: polygon ? "parcel" : "buffer",
    headline: intersecting.length
      ? "Il lotto incontra un'area protetta presente nei dati europei."
      : features.length
        ? "Sono presenti aree protette entro un chilometro dal lotto."
        : complete
          ? "I dati europei non restituiscono aree protette entro un chilometro."
          : "I dati sulle aree protette sono disponibili solo in parte.",
    severity: intersecting.length ? "medium" : features.length ? "low" : "unknown",
    metrics: [
      {
        key: "intersecting_sites",
        label: "Aree che contengono o intersecano il lotto",
        value: intersecting.length,
        unit: "aree",
      },
      {
        key: "nearby_sites",
        label: "Aree vicine senza intersezione",
        value: features.length - intersecting.length,
        unit: "aree",
      },
      { key: "search_radius", label: "Distanza massima di ricerca dal lotto", value: radiusM, unit: "m" },
    ],
    features: { type: "FeatureCollection", features },
    legend: [
      { classKey: "natura2000", label: "Natura 2000" },
      { classKey: "natda", label: "Area protetta nazionale (NatDA)" },
    ],
    method:
      "Relazioni contains/intersects/nearby sulle geometrie EEA; distanza approssimata tra vertici e segmenti geodetici. Nessuna percentuale di sovrapposizione stimata.",
    notes: [
      "Il confronto usa i confini pubblicati; le distanze sono approssimate.",
      "La vicinanza non implica un vincolo sul lotto; per gli effetti consultare gli atti e il piano del gestore.",
      "Le aree protette nazionali sono distinte dalla rete Natura 2000. Queste mappe possono non comprendere altre tutele nazionali o regionali.",
    ],
    provenance: answered.map((a) => a.provenance),
  });
};
