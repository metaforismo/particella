import type { LayerProvider } from "#server/core/layers.ts";
import { layerResult, overlay } from "#server/core/layers.ts";
import { provenance } from "#server/core/provenance.ts";
import { fetchSource, parseGeo, wmsPointParams } from "#server/countries/it/queries.ts";
import { identifyNote, landslideClass, severityForHazard } from "#server/countries/it/layers/hazards.ts";

export const landslide: LayerProvider = async (plot, { signal }) => {
  const results = await Promise.allSettled([
    ...["idrogeo", "iffi"].map(async (id) => {
      const payload = await fetchSource(
        id,
        wmsPointParams(id === "iffi" ? "idrogeo:frane" : "idrogeo:pericolosita_frane", plot.centroid),
        { signal },
      );
      const collection = parseGeo(payload);
      const features = collection.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          classKey: id === "iffi" ? "IFFI" : (landslideClass(f.properties) ?? "unknown"),
        },
      }));
      return { id, features, provenance: provenance(id, payload) };
    }),
  ]);
  const answered = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const features = answered.flatMap((r) => r.features);
  const classes = [
    ...new Set(features.filter((f) => f.properties.classKey !== "IFFI").map((f) => f.properties.classKey)),
  ];
  const complete = answered.length === 2 && !classes.includes("unknown");
  return layerResult("landslide", {
    status: complete ? (features.length ? "ok" : "empty") : answered.length ? "partial" : "unavailable",
    scope: "point",
    headline: classes.length
      ? classes.includes("unknown")
        ? "La fonte segnala un’area PAI sul punto, ma la classe non è riconosciuta."
        : `La fonte segnala pericolosità da frana ${classes.join(", ")} sul punto.`
      : features.length
        ? "L'inventario segnala un fenomeno franoso sul punto."
        : complete
          ? "La fonte non restituisce frane o aree PAI su questo punto."
          : "I dati sulle frane sono disponibili solo in parte.",
    severity: severityForHazard(classes),
    metrics: [
      { key: "pai_classes", label: "Classi PAI al punto", value: classes.join(", ") || null },
      {
        key: "iffi_count",
        label: "Fenomeni IFFI al punto",
        value: answered.find((a) => a.id === "iffi")?.features.length ?? null,
        unit: "fenomeni",
      },
    ],
    features: { type: "FeatureCollection", features },
    overlays: [overlay("landslide", "ISPRA e Regioni / Province autonome · CC BY-SA 4.0")],
    legend: ["P1", "P2", "P3", "P4", "AA", "IFFI", "unknown"].map((classKey) => ({
      classKey,
      label:
        classKey === "AA"
          ? "AA: area di attenzione"
          : classKey === "IFFI"
            ? "IFFI: fenomeno inventariato"
            : classKey === "unknown"
              ? "Classe non riconosciuta"
              : `Pericolosità ${classKey}`,
    })),
    method: identifyNote,
    notes: [
      "La verifica riguarda un punto interno, non tutto il terreno.",
      ...(!answered.some((a) => a.id === "iffi")
        ? ["L’inventario IFFI non è disponibile in questa risposta."]
        : []),
      ...(!answered.some((a) => a.id === "idrogeo")
        ? ["La pericolosità PAI non è disponibile in questa risposta."]
        : []),
      "L’inventario elenca frane già conosciute. Le aree di attenzione richiedono una verifica anche quando manca una classe di pericolosità.",
      "Un risultato vuoto non esclude rischi. La data di aggiornamento della mappa non è indicata.",
    ],
    provenance: answered.map((r) => r.provenance),
  });
};
