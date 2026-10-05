import { layerResult, runLayer, type LayerProvider } from "#server/core/layers.ts";
import { provenance } from "#server/core/provenance.ts";
import { source } from "#server/core/sources.ts";
import { fetchSource, parseGeo } from "#server/countries/it/queries.ts";
import { measurements, coversPoint, type PlotGeometry } from "#server/geo/index.ts";
import { services } from "#server/countries/it/layers/services.ts";
import { UpstreamError } from "#server/core/errors.ts";

export const accessibility: LayerProvider = async (plot, { signal }) => {
  if (
    process.env.NODE_ENV === "production" &&
    new URL(source("valhalla").endpoint).host === "valhalla1.openstreetmap.de" &&
    process.env.PARTICELLA_SINGLE_INSTANCE !== "1"
  )
    return layerResult("accessibility", {
      status: "outside_coverage",
      scope: "buffer",
      headline: "Il calcolo dei percorsi non è ancora collegato per questo servizio.",
      notes: [
        "Il servizio pubblico di prova richiede un limite condiviso fra tutte le istanze. Configurare un servizio di percorsi dedicato.",
      ],
    });
  const modes = [
    { classKey: "walk-10", costing: "pedestrian", label: "A piedi, 10 minuti" },
    { classKey: "car-10", costing: "auto", label: "In auto, 10 minuti" },
  ];
  const results = await Promise.allSettled(
    modes.map(async (mode) => {
      const payload = await fetchSource(
        "valhalla",
        {
          json: JSON.stringify({
            locations: [plot.centroid],
            costing: mode.costing,
            contours: [{ time: 10 }],
            polygons: true,
          }),
        },
        {
          signal,
          timeoutMs: 20_000,
          retries: 0,
          headers: { "X-Client-Id": "Particella/0.1 (+https://github.com/metaforismo/particella)" },
        },
      );
      const rows = parseGeo(payload).features;
      if (
        rows.length !== 1 ||
        (rows[0].geometry?.type !== "Polygon" && rows[0].geometry?.type !== "MultiPolygon") ||
        Number(rows[0].properties.contour) !== 10
      )
        throw new UpstreamError("Isocrona non valida.");
      return {
        mode,
        feature: { ...rows[0], properties: { ...rows[0].properties, classKey: mode.classKey } },
        provenance: provenance("valhalla", payload),
      };
    }),
  );
  const answered = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (!answered.length) throw new UpstreamError("Il servizio di percorsi non ha risposto.");
  // runLayer shares the services request with the report and the services route.
  const nearby = await runLayer("services", plot, services);
  const serviceFeatures = nearby.features?.features ?? [];
  const countsAvailable = ["ok", "empty"].includes(nearby.status);
  return layerResult("accessibility", {
    status: answered.length === modes.length ? "ok" : "partial",
    scope: "buffer",
    severity: "none",
    headline:
      answered.length === modes.length
        ? "Sono disponibili le aree raggiungibili in 10 minuti a piedi e in auto."
        : "È disponibile solo una delle due aree raggiungibili in 10 minuti.",
    features: { type: "FeatureCollection", features: answered.map((r) => r.feature) },
    legend: modes.map(({ classKey, label }) => ({ classKey, label })),
    metrics: answered.flatMap(({ mode, feature }) => [
      {
        key: `${mode.classKey}-area`,
        label: `${mode.label}: superficie raggiungibile`,
        value: Math.round((measurements(feature.geometry as PlotGeometry).areaM2 / 10000) * 10) / 10,
        unit: "ha",
      },
      {
        key: `${mode.classKey}-services`,
        label: `${mode.label}: servizi censiti entro 1 km`,
        value: countsAvailable
          ? serviceFeatures.filter(
              (f) =>
                f.geometry?.type === "Point" &&
                coversPoint(feature.geometry as PlotGeometry, {
                  lon: f.geometry.coordinates[0],
                  lat: f.geometry.coordinates[1],
                }),
            ).length
          : null,
        unit: "luoghi",
        hint: "Solo i servizi della ricerca entro 1 km, non un conteggio di tutta l’area raggiungibile.",
      },
    ]),
    method:
      "Valhalla/FOSSGIS isochrone, costing pedestrian e auto, time=10 min, polygons=true. Area geodetica Turf. Join spaziale ai servizi Overpass della stessa cache, limitati a 1 km; nessuna seconda query Overpass.",
    notes: [
      "Le aree sono stime sulla rete stradale: non considerano il traffico attuale e non attestano accesso a ZTL, cancelli o proprietà private.",
      "I servizi contati sono solo quelli censiti entro un chilometro: quelli più lontani non vengono cercati.",
      "© OpenStreetMap contributors, dati ODbL. Il servizio pubblico di prova non garantisce disponibilità continua.",
    ],
    provenance: [...answered.map((r) => r.provenance), ...(countsAvailable ? nearby.provenance : [])],
  });
};
