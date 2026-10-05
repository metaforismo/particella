import { z } from "zod";
import { layerResult, type LayerProvider } from "#server/core/layers.ts";
import { provenance } from "#server/core/provenance.ts";
import { source } from "#server/core/sources.ts";
import { http, textBody } from "#server/core/http.ts";
import { wfsMembers } from "#server/geo/gml.ts";
import { UpstreamError } from "#server/core/errors.ts";
import {
  fetchSource,
  wmsPointParams,
  arcPointParams,
  queryUrl,
  parseArc,
} from "#server/countries/it/queries.ts";

const FirenzeZone = z.object({
  tipologia: z.string().min(1),
  descrizione: z.string().min(1),
  data_inizio: z.string().optional(),
});

export function parseFirenzePlanning(text: string) {
  return wfsMembers(text).map((row) => {
    const parsed = FirenzeZone.safeParse(row);
    if (!parsed.success) throw new UpstreamError("Ambito del Piano Operativo non riconosciuto.");
    return parsed.data;
  });
}

const regionalPortals: Record<string, string> = {
  Toscana: "https://www.regione.toscana.it/-/geoscopio",
  Lombardia: "https://www.geoportale.regione.lombardia.it/",
  Piemonte: "https://www.geoportale.piemonte.it/",
  "Emilia-Romagna": "https://geoportale.regione.emilia-romagna.it/",
  Veneto: "https://idt2.regione.veneto.it/",
};

export const planning: LayerProvider = async (plot, { signal }) => {
  const municipality = plot.municipality;
  if (municipality?.istatCode === "048017") {
    const payload = await fetchSource(
      "planning-firenze",
      {
        ...wmsPointParams("poc:v_po_timewms_subsistemi_ambiti_vigente", plot.centroid, 0.01),
        info_format: "application/vnd.ogc.gml",
      },
      { signal },
    );
    const zones = parseFirenzePlanning(textBody(payload));
    return layerResult("planning", {
      scope: "point",
      status: zones.length ? "ok" : "empty",
      severity: "unknown",
      headline: zones.length
        ? // Descriptions start with their own article ("ambito dell'…", "sub-sistema della…").
          `Piano Operativo di Firenze: ${zones.map((z) => z.descrizione).join("; ")}.`
        : "Il Piano Operativo non restituisce un ambito sul punto controllato.",
      metrics: zones.map((z) => ({
        key: z.tipologia,
        label: "Ambito del Piano Operativo",
        value: z.descrizione,
        hint: z.data_inizio ? `Decorrenza dichiarata: ${z.data_inizio}` : null,
      })),
      legend: zones.map((z) => ({ classKey: `firenze-${z.tipologia}`, label: z.descrizione })),
      notes: [
        "La verifica riguarda un punto interno. Un ambito non riassume tutte le regole del terreno.",
        "Prima di decidere, consultare norme e tavole del Comune, richiedere il certificato di destinazione urbanistica e coinvolgere un tecnico abilitato.",
      ],
      method:
        "WMS GetFeatureInfo GML del layer vigente subsistemi/ambiti; EPSG:4326, bbox ±0,01°, pixel centrale 101×101. Gli altri strati del PO non sono inclusi.",
      provenance: [provenance("planning-firenze", payload, { referenceDate: zones[0]?.data_inizio ?? null })],
    });
  }
  if (municipality?.istatCode === "015146") {
    const s = source("planning-milano");
    const payload = await http.request(queryUrl(s.endpoint + "/20/query", arcPointParams(plot.centroid)), {
      signal,
      policy: s.hostPolicy,
    });
    const rows = parseArc(payload).features.map(({ attributes: row }) => {
      const parsed = z
        .object({
          COD_ISTAT: z.coerce.string(),
          AMB_URB: z.coerce.string(),
          DCOD_DEST1: z.string().min(1),
          DSPEC_DEST: z.string().nullable().optional(),
        })
        .safeParse(row);
      if (!parsed.success || parsed.data.COD_ISTAT.padStart(6, "0") !== "015146")
        throw new UpstreamError("Ambito PGT non riconosciuto per Milano.");
      return parsed.data;
    });
    return layerResult("planning", {
      scope: "point",
      status: rows.length ? "ok" : "empty",
      severity: "unknown",
      headline: rows.length
        ? `La sintesi PGT indica: ${[...new Set(rows.map((r) => r.DCOD_DEST1.toLowerCase()))].join(", ")}.`
        : "La sintesi PGT non restituisce un ambito sul punto controllato.",
      metrics: rows.map((r) => ({
        key: `ambito-${r.AMB_URB}`,
        label: "Ambito nella sintesi PGT",
        value: [r.DCOD_DEST1, r.DSPEC_DEST].filter(Boolean).join(" · "),
      })),
      legend: rows.map((r) => ({ classKey: `milano-${r.AMB_URB}`, label: r.DCOD_DEST1 })),
      notes: [
        "La verifica riguarda un punto. La Tavola delle Previsioni è una sintesi regionale e non stabilisce da sola gli interventi consentiti.",
        "La licenza del dataset non è accertata. Consultare il Geoportale e il PGT del Comune di Milano per norme, aggiornamenti e condizioni di riuso.",
        "Richiedere il certificato di destinazione urbanistica e una verifica di un tecnico abilitato.",
      ],
      method:
        "ArcGIS REST identify al punto: layer 20 Ambiti del tessuto urbano consolidato della Tavola delle Previsioni; EPSG:4326. Ambiti di trasformazione e altre tavole non inclusi.",
      provenance: [provenance("planning-milano", payload)],
    });
  }
  const portal = regionalPortals[municipality?.region ?? ""];
  return layerResult("planning", {
    status: "outside_coverage",
    scope: "municipality",
    severity: "unknown",
    headline: `Il piano di ${municipality?.name ?? "questo Comune"} non è ancora collegato.`,
    notes: [
      "Consultare l’ufficio urbanistica del Comune per il piano vigente e il certificato di destinazione urbanistica.",
      ...(portal ? [`Il geoportale regionale è consultabile su ${portal}`] : []),
    ],
  });
};
