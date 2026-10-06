import { z } from "zod";
import legend from "../planning-veneto-legend.json" with { type: "json" };
import { layerResult, type LayerProvider } from "#server/core/layers.ts";
import { provenance } from "#server/core/provenance.ts";
import { UpstreamError } from "#server/core/errors.ts";
import { coversPoint, type PlotGeometry } from "#server/geo/index.ts";
import { fetchSource, parseGeo, wmsPointParams } from "#server/countries/it/queries.ts";

const Zone = z.object({
  cod_istat: z.string().regex(/^\d{6}$/),
  sub_1: z.string(),
  sub_2: z.string(),
  sub_3: z.string(),
  sub_4: z.string(),
  fonte: z.enum(["PI", "PAT", "PRG"]),
  datatrasmi: z.string().nullable(),
});
const labels: Record<string, string> = legend.labels;

export const venetoPlanning: LayerProvider = async (plot, { signal }) => {
  const payload = await fetchSource(
    "planning-veneto",
    { ...wmsPointParams("rv:zonizzazione_072026", plot.centroid), buffer: 0 },
    { signal, timeoutMs: 6500, retries: 0 },
  );
  const rows = parseGeo(payload)
    .features.filter((f) => {
      if (f.geometry?.type !== "Polygon" && f.geometry?.type !== "MultiPolygon")
        throw new UpstreamError("Geometria del mosaico veneto non valida.");
      return coversPoint(f.geometry as PlotGeometry, plot.centroid);
    })
    .map((f) => {
      const parsed = Zone.safeParse(f.properties);
      if (!parsed.success || parsed.data.cod_istat !== plot.municipality!.istatCode)
        throw new UpstreamError("Comune o codici del mosaico veneto non riconosciuti.");
      return parsed.data;
    });
  const label = (r: z.infer<typeof Zone>) => labels[r.sub_1] ?? `Codice di zona ${r.sub_1}`;
  return layerResult("planning", {
    status: rows.length ? "ok" : "empty",
    scope: "point",
    severity: "unknown",
    headline: rows.length
      ? `Mosaico urbanistico di ${plot.municipality!.name}: ${[...new Set(rows.map(label))].join("; ")}.`
      : "Il mosaico regionale non restituisce una zona sul punto controllato.",
    metrics: rows.flatMap((r, i) => [
      { key: `zone-${i}`, label: "Zona nella legenda regionale", value: label(r) },
      {
        key: `subzone-${i}`,
        label: "Codici delle sottozone",
        value: [r.sub_2, r.sub_3, r.sub_4].join(" / "),
      },
      { key: `code-${i}`, label: "Codice completo", value: [r.sub_1, r.sub_2, r.sub_3, r.sub_4].join(" / ") },
      { key: `plan-${i}`, label: "Strumento dichiarato dalla fonte", value: r.fonte },
    ]),
    notes: [
      "La rappresentazione regionale non ha valore conformativo: consultare il piano e le norme del Comune.",
      "Il servizio raccoglie PI, PAT e PRG: lo strumento dichiarato è indicato nei dati. La data di trasmissione può mancare e non prova l’efficacia del piano.",
      "I nomi delle zone provengono dalla legenda regionale; le sottozone restano nei codici originali, senza interpretazioni.",
      "Regione del Veneto – L.R. n. 28/76 – Formazione della Carta Tecnica Regionale. Dati IODL 2.0.",
    ],
    method:
      "WMS 1.1.1 GetFeatureInfo GeoJSON, rv:zonizzazione_072026, EPSG:4326, bbox ±0,0001°, buffer zero; filtro geometrico di contenimento e verifica cod_istat. Legenda ufficiale SLD conservata come snapshot; sintesi non conformativa, non disciplina edilizia certificata.",
    provenance: [
      provenance("planning-veneto", payload, { referenceDate: "2026-06-30" }),
      provenance(
        "planning-veneto-legend",
        { requestUrl: legend.sourceUrl, retrievedAt: legend.retrievedAt },
        { method: "snapshot" },
      ),
    ],
  });
};
