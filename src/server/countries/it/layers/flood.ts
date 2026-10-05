import type { LayerProvider } from "../../../core/layers.ts";
import { layerResult, overlay } from "../../../core/layers.ts";
import { provenance } from "../../../core/provenance.ts";
import { fetchSource, parseGeo, wmsPointParams } from "../queries.ts";
import { severityForHazard, identifyNote } from "./hazards.ts";

export const flood: LayerProvider = async (plot, { signal }) => {
  const scenarios = ["P1", "P2", "P3"] as const;
  const results = await Promise.allSettled(
    scenarios.map(async (classKey) => {
      const payload = await fetchSource(
        "idrogeo",
        wmsPointParams(`idrogeo:pericolosita_idraulica_${classKey.toLowerCase()}`, plot.centroid),
        { signal },
      );
      return {
        classKey,
        features: parseGeo(payload).features.map((f) => ({
          ...f,
          properties: { ...f.properties, classKey },
        })),
        provenance: provenance("idrogeo", payload, {
          dataset: `Pericolosità idraulica ${classKey}; release live non dichiarata`,
        }),
      };
    }),
  );
  const answered = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const features = answered.flatMap((r) => r.features),
    classes = answered.filter((r) => r.features.length).map((r) => r.classKey);
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
    notes: [
      identifyNote,
      "P1/P2/P3 sono scenari distinti, non probabilità calcolate sul lotto. Nessun dato restituito non significa assenza di rischio.",
      "La data della mosaicatura live non è dichiarata; verificare il PAI vigente e gli studi locali.",
      "Dati e derivati ISPRA: CC BY-SA 4.0; attribuzione e condivisione con stessa licenza.",
    ],
    provenance: answered.map((r) => r.provenance),
  });
};
