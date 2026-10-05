import inventory from "../../../../../data/snapshots/it-sitap-layers.json" with { type: "json" };
import { layerResult, type LayerProvider } from "#server/core/layers.ts";
import { provenance } from "#server/core/provenance.ts";
import { fetchSource, parseGeo, wmsPointParams } from "#server/countries/it/queries.ts";

export const landscape: LayerProvider = async (plot, { signal }) => {
  const region = plot.municipality?.region?.toLowerCase().replace(/[^a-z]/g, "_");
  const layers = inventory.layers.filter((name) => region && name.startsWith(region + "_"));
  if (!layers.length)
    return layerResult("landscape", {
      status: "outside_coverage",
      scope: "point",
      headline: "I vincoli paesaggistici di questa regione non sono ancora collegati.",
      notes: ["Consultare il piano paesaggistico regionale e il Comune."],
      provenance: [
        provenance("sitap", { requestUrl: inventory.sourceUrl, retrievedAt: inventory.retrievedAt }),
      ],
    });
  const requests = [
    { classKey: "art-136", layers: layers.filter((l) => l.includes("136")) },
    { classKey: "art-142", layers: layers.filter((l) => l.includes("142")) },
  ].filter((r) => r.layers.length);
  const responses = await Promise.allSettled(
    requests.map(async (request) => {
      const payload = await fetchSource("sitap", wmsPointParams(request.layers.join(","), plot.centroid), {
        signal,
      });
      const features = parseGeo(payload).features.map((feature) => ({
        ...feature,
        properties: { ...feature.properties, classKey: request.classKey },
      }));
      return { features, provenance: provenance("sitap", payload) };
    }),
  );
  const answered = responses.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const features = answered.flatMap((r) => r.features);
  const complete = answered.length === requests.length;
  return layerResult("landscape", {
    status: !answered.length ? "unavailable" : complete ? (features.length ? "ok" : "empty") : "partial",
    scope: "point",
    severity: features.length ? "medium" : "unknown",
    headline: features.length
      ? "SITAP segnala una tutela paesaggistica sul punto del terreno."
      : complete
        ? "SITAP non restituisce tutele sul punto controllato."
        : "La verifica delle tutele paesaggistiche è incompleta.",
    metrics: [
      { key: "identified_constraints", label: "Tutele al punto", value: features.length, unit: "tutele" },
    ],
    features: { type: "FeatureCollection", features },
    legend: [
      { classKey: "art-136", label: "Beni di notevole interesse pubblico — art. 136" },
      { classKey: "art-142", label: "Aree tutelate per legge — art. 142" },
    ],
    method: `GetFeatureInfo WMS sul punto rappresentativo, non intersezione del lotto; EPSG:4326, bbox ±0,0001°, pixel centrale 101×101; layer ${layers.join(", ")}. Inventario capabilities ${inventory.retrievedAt}.`,
    notes: [
      "La verifica riguarda un punto interno, non tutto il lotto. Le categorie disponibili non comprendono tutte le tutele previste dalla legge.",
      "SITAP è una ricognizione: può essere incompleto o non aggiornato. Verificare il piano paesaggistico regionale, gli atti e il Comune.",
      "La licenza di riuso del dataset non è accertata; consultare la fonte per gli usi successivi.",
    ],
    provenance: answered.map((r) => r.provenance),
  });
};
