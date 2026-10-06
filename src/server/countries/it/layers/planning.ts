import { venetoPlanning } from "#server/countries/it/layers/planning-veneto.ts";
import { z } from "zod";
import { layerResult, type LayerProvider } from "#server/core/layers.ts";
import { provenance } from "#server/core/provenance.ts";

import { textBody } from "#server/core/http.ts";
import { wfsMembers } from "#server/geo/gml.ts";
import { UpstreamError } from "#server/core/errors.ts";
import { fetchSource, wmsPointParams } from "#server/countries/it/queries.ts";
import {
  planningArea,
  lombardiaPlanning,
  torinoPlanning,
  sienaPlanning,
} from "#server/countries/it/layers/planning-regional.ts";

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
  Puglia: "https://pugliacon.regione.puglia.it/web/sit-puglia-sit",
  Lazio: "https://geoportale.regione.lazio.it/",
};

export const planning: LayerProvider = async (plot, { signal }) => {
  const municipality = plot.municipality;
  if (
    municipality?.istatCode === "048017" &&
    municipality.cadastralCode === "D612" &&
    plot.cadastral.municipalityCode === "D612"
  ) {
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
      metrics: zones.flatMap((z, i) => [
        {
          key: z.tipologia,
          label: "Ambito del Piano Operativo",
          value: z.descrizione,
          hint: z.data_inizio ? `Decorrenza dichiarata: ${z.data_inizio}` : null,
        },
        {
          key: `zone-${i}`,
          label: "Zona dichiarata nella descrizione",
          value: z.descrizione.match(/\bzona ([A-Z][A-Z0-9]*)/i)?.[1] ?? null,
        },
        {
          key: `subzone-${i}`,
          label: "Sottozona dichiarata nella descrizione",
          value: z.descrizione.match(/\bsottozona ([A-Z][A-Z0-9]*)/i)?.[1] ?? null,
        },
        {
          key: `code-${i}`,
          label: "Codice del piano",
          value: z.tipologia,
        },
      ]),
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
  const area = planningArea(plot);
  if (area === "lombardia") return lombardiaPlanning(plot, { signal });
  if (area === "torino") return torinoPlanning(plot, { signal });
  if (area === "siena") return sienaPlanning(plot, { signal });
  if (area === "veneto") return venetoPlanning(plot, { signal });
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
