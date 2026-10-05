import type { LayerProvider } from "#server/core/layers.ts";
import { layerResult, overlay } from "#server/core/layers.ts";
import { provenance } from "#server/core/provenance.ts";
import { fetchSource, parseGeo, wmsPointParams } from "#server/countries/it/queries.ts";
import { severityForHazard, identifyNote } from "#server/countries/it/layers/hazards.ts";

export const flood: LayerProvider = async (plot, { signal }) => {
  const scenarios = ["P1", "P2", "P3"] as const;
  const results = await Promise.allSettled(
    scenarios.map(async (classKey) => {
      const payload = await fetchSource(
        "idrogeo",
        {
          ...wmsPointParams(`idrogeo:pericolosita_idraulica_${classKey.toLowerCase()}`, plot.centroid),
          propertyName: `id,scenario${classKey.toLowerCase()}`,
        },
        { signal },
      );
      return {
        classKey,
        features: parseGeo(payload).features.map((f) => ({
          ...f,
          properties: { ...f.properties, classKey },
        })),
        provenance: provenance("idrogeo", payload, {
          dataset: `Alluvioni — scenario ${classKey}`,
        }),
      };
    }),
  );
  const answered = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const features = answered.flatMap((r) => r.features);
  const classes = answered.filter((r) => r.features.length).map((r) => r.classKey);
  const complete = answered.length === scenarios.length;
  return layerResult("flood", {
    status: complete ? (features.length ? "ok" : "empty") : answered.length ? "partial" : "unavailable",
    scope: "point",
    headline: classes.length
      ? `Il punto ricade negli scenari di alluvione ${classes.join(", ")}.`
      : complete
        ? "La fonte non restituisce aree di alluvione su questo punto."
        : "Non tutti gli scenari di alluvione sono disponibili.",
    severity: classes.length ? severityForHazard(classes) : "unknown",
    metrics: [{ key: "scenarios", label: "Scenari al punto", value: classes.join(", ") || null, unit: null }],
    features: { type: "FeatureCollection", features },
    legend: [
      { classKey: "P1", label: "P1: bassa probabilità" },
      { classKey: "P2", label: "P2: media probabilità" },
      { classKey: "P3", label: "P3: elevata probabilità" },
    ],
    overlays: [overlay("flood", "ISPRA IdroGEO · CC BY-SA 4.0")],
    method: `${identifyNote} PropertyName limita la risposta a id e scenario; geometrie escluse, overlay raster dal proxy.`,
    notes: [
      "La verifica riguarda un punto interno, non tutto il terreno.",
      "P1/P2/P3 sono scenari distinti, non probabilità calcolate sul lotto. Nessun dato restituito non significa assenza di rischio.",
      "La data di aggiornamento della mappa non è indicata: verificare il piano vigente e gli studi locali.",
    ],
    provenance: answered.map((r) => r.provenance),
  });
};
