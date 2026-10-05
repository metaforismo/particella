import type { LayerProvider } from "../../../core/layers.ts";
import { layerResult, overlay } from "../../../core/layers.ts";
import { provenance } from "../../../core/provenance.ts";
import { fetchSource, parseGeo, wmsPointParams } from "../queries.ts";
import { identifyNote, landslideClass, severityForHazard } from "./hazards.ts";

export const landslide: LayerProvider = async (plot, { signal }) => {
  const results = await Promise.allSettled([...["idrogeo", "iffi"].map(async (id) => {
    const payload = await fetchSource(id, wmsPointParams(id === "iffi" ? "idrogeo:frane" : "idrogeo:pericolosita_frane", plot.centroid), { signal });
    const collection = parseGeo(payload);
    const features = collection.features.map((f) => ({ ...f, properties: { ...f.properties, classKey: id === "iffi" ? "IFFI" : landslideClass(f.properties) ?? "unknown" } }));
    return { id, features, provenance: provenance(id, payload) };
  })]);
  const answered = results.flatMap((r) => r.status === "fulfilled" ? [r.value] : []);
  const features = answered.flatMap((r) => r.features), classes = [...new Set(features.filter((f) => f.properties.classKey !== "IFFI").map((f) => f.properties.classKey))];
  const complete = answered.length === 2 && !classes.includes("unknown");
  return layerResult("landslide", { status: complete ? features.length ? "ok" : "empty" : answered.length ? "partial" : "unavailable", scope: "point", headline: classes.length ? `La fonte segnala pericolosità da frana ${classes.join(", ")} sul punto.` : features.length ? "L'inventario segnala un fenomeno franoso sul punto." : complete ? "La fonte non restituisce frane o aree PAI su questo punto." : "I dati sulle frane sono disponibili solo in parte.", severity: severityForHazard(classes), metrics: [{ key: "pai_classes", label: "Classi PAI al punto", value: classes.join(", ") || null }, { key: "iffi_count", label: "Fenomeni IFFI al punto", value: answered.find((a) => a.id === "iffi")?.features.length ?? null, unit: "fenomeni" }], features: { type: "FeatureCollection", features }, overlays: [overlay("landslide", "ISPRA e Regioni / Province autonome · CC BY-SA 4.0")], legend: ["P1", "P2", "P3", "P4", "AA", "IFFI", "unknown"].map((classKey) => ({ classKey, label: classKey === "AA" ? "AA: area di attenzione" : classKey === "IFFI" ? "IFFI: fenomeno inventariato" : classKey === "unknown" ? "Classe non riconosciuta" : `Pericolosità ${classKey}` })), notes: [identifyNote, "IFFI è un inventario di fenomeni conosciuti, distinto dalle classi PAI. AA non è una classe graduata di pericolosità.", "Assenza di oggetti non significa assenza di rischio; release live non dichiarata.", "Dati e derivati ISPRA: CC BY-SA 4.0; attribuzione ISPRA e Regione/Provincia autonoma."], provenance: answered.map((r) => r.provenance) });
};
