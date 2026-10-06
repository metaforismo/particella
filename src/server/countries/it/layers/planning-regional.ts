import { z } from "zod";
import type { Plot } from "#contracts";
import { layerResult, type LayerProvider } from "#server/core/layers.ts";
import { provenance } from "#server/core/provenance.ts";
import { jsonBody, textBody } from "#server/core/http.ts";
import { UpstreamError } from "#server/core/errors.ts";
import { fetchSource, wmsPointParams, parseGeo } from "#server/countries/it/queries.ts";

const advice =
  "Prima di decidere, consultare le norme e le varianti comunali e richiedere il certificato di destinazione urbanistica a un tecnico abilitato.";

/** Dispatch only with coherent ISTAT and Belfiore identities; no geographic guess. */
export function planningArea(plot: Plot): "lombardia" | "torino" | "siena" | "veneto" | null {
  const m = plot.municipality;
  if (!m || m.cadastralCode !== plot.cadastral.municipalityCode) return null;
  if (m.istatCode === "001272" && m.cadastralCode === "L219") return "torino";
  if (m.istatCode === "052032" && m.cadastralCode === "I726") return "siena";
  if (m.region === "Veneto" && /^(023|024|025|026|027|028|029)\d{3}$/.test(m.istatCode)) return "veneto";
  if (
    m.region === "Lombardia" &&
    /^(012|013|014|015|016|017|018|019|020|097|098|108)\d{3}$/.test(m.istatCode)
  )
    return "lombardia";
  return null;
}

const Identify = z.object({
  results: z.array(z.object({ layerId: z.number(), attributes: z.record(z.string(), z.unknown()) })).max(99),
  exceededTransferLimit: z.boolean().optional(),
});

export function parseLombardiaPlanning(value: unknown, istat: string) {
  const result = Identify.safeParse(value);
  if (!result.success || result.data.exceededTransferLimit)
    throw new UpstreamError("Sintesi PGT non valida o incompleta.");
  return result.data.results.map(({ layerId, attributes: a }) => {
    if (![13, 19, 20].includes(layerId) || String(a.COD_ISTAT).padStart(6, "0") !== istat)
      throw new UpstreamError("La sintesi PGT restituisce un Comune diverso dal lotto.");
    const fields =
      layerId === 20
        ? [a.DCOD_DEST1, a.DSPEC_DEST, a.AMB_URB]
        : layerId === 19
          ? [a.LEGENDA, a.SPEC_AGRD, a.COD_AGR]
          : [a.DFUN_PREV1, a.DSPEC_DEST, a.AMB_TRAS];
    const [zone, subzone, code] = fields;
    if (typeof zone !== "string" || !zone.trim() || (typeof code !== "string" && typeof code !== "number"))
      throw new UpstreamError("Attributi PGT non riconosciuti.");
    return {
      layerId,
      zone: zone.trim(),
      subzone: typeof subzone === "string" && subzone !== "Null" && subzone.trim() ? subzone.trim() : null,
      code: String(code),
      localZone: typeof a.LEGENDA === "string" && a.LEGENDA.trim() ? a.LEGENDA.trim() : null,
    };
  });
}

export const lombardiaPlanning: LayerProvider = async (plot, { signal }) => {
  const { lat, lon } = plot.centroid;
  const payload = await fetchSource(
    "planning-lombardia",
    {
      f: "json",
      geometry: `${lon},${lat}`,
      geometryType: "esriGeometryPoint",
      sr: 4326,
      layers: "all:20,19,13",
      tolerance: 0,
      mapExtent: `${lon - 0.001},${lat - 0.001},${lon + 0.001},${lat + 0.001}`,
      imageDisplay: "101,101,96",
      returnGeometry: false,
    },
    { signal, timeoutMs: 6500, retries: 0 },
  );
  const rows = parseLombardiaPlanning(jsonBody(payload), plot.municipality!.istatCode);
  return layerResult("planning", {
    scope: "point",
    status: rows.length ? "ok" : "empty",
    severity: "unknown",
    headline: rows.length
      ? `Sintesi PGT di ${plot.municipality!.name}: ${[...new Set(rows.map((r) => r.localZone ?? r.zone))].join("; ")}.`
      : "La sintesi PGT non restituisce una zona sul punto controllato.",
    metrics: rows.flatMap((r, i) => [
      { key: `zone-${i}`, label: "Zona nella sintesi PGT", value: r.localZone ?? r.zone },
      { key: `destination-${i}`, label: "Destinazione regionale", value: r.zone },
      { key: `subzone-${i}`, label: "Sottozona / specificazione dichiarata", value: r.subzone },
      { key: `code-${i}`, label: "Codice ambito", value: r.code },
    ]),
    legend: rows.map((r) => ({ classKey: `lombardia-${r.layerId}-${r.code}`, label: r.localZone ?? r.zone })),
    notes: [
      "La Tavola delle Previsioni è una sintesi regionale non conformativa: non determina da sola gli interventi consentiti.",
      "Sono interrogati tessuto urbano consolidato, aree agricole e ambiti di trasformazione. Un vuoto non significa assenza di disciplina.",
      "La data di efficacia del piano comunale non è dichiarata da questa risposta.",
      advice,
    ],
    method:
      "ArcGIS REST identify puntuale, EPSG:4326, tolleranza zero, layer 20/19/13 della Tavola delle Previsioni a scala 1:10.000; verifica COD_ISTAT contro il Comune del lotto. Sintesi non conformativa, non sostituisce Piano delle Regole/Piano dei Servizi.",
    provenance: [provenance("planning-lombardia", payload)],
  });
};

export function parseTorinoPlanning(text: string) {
  if (!text.startsWith("GetFeatureInfo results:"))
    throw new UpstreamError("Risposta PRG Torino non riconosciuta.");
  const rows: { layer: string; fields: Record<string, string> }[] = [];
  let layer = "";
  let current: (typeof rows)[number] | undefined;
  for (const line of text.split(/\r?\n/)) {
    const l = line.match(/^Layer '([^']+)'$/);
    if (l) {
      layer = l[1];
      current = undefined;
      continue;
    }
    if (/^\s+Feature \d+:\s*$/.test(line)) {
      if (!["AreeDiPiano", "ZonediPiano", "Servizi"].includes(layer))
        throw new UpstreamError("Layer PRG inatteso.");
      current = { layer, fields: {} };
      rows.push(current);
      continue;
    }
    const field = line.match(/^\s+(\w+) = '(.*)'\s*$/);
    if (field && current) current.fields[field[1]] = field[2];
    else if (
      line.trim() &&
      !l &&
      !line.startsWith("GetFeatureInfo results:") &&
      !/^\s*(?:no features were found|Search returned no results)\.?\s*$/i.test(line)
    )
      throw new UpstreamError("Attributi PRG Torino non riconosciuti.");
  }
  if (rows.length >= 100) throw new UpstreamError("Risposta PRG troncata.");
  for (const r of rows)
    if (!(r.fields.zona_di_piano || r.fields.area_di_piano || r.fields.servizio))
      throw new UpstreamError("Descrizione PRG mancante.");
  return rows;
}

export const torinoPlanning: LayerProvider = async (plot, { signal }) => {
  const payload = await fetchSource(
    "planning-torino",
    { ...wmsPointParams("ZonediPiano,AreeDiPiano", plot.centroid, 0.001), info_format: "text/plain" },
    { signal, timeoutMs: 6500, retries: 0 },
  );
  const rows = parseTorinoPlanning(textBody(payload));
  return layerResult("planning", {
    status: rows.length ? "ok" : "empty",
    scope: "point",
    severity: "unknown",
    headline: rows.length
      ? `PRG di Torino: ${rows.map((r) => r.fields.zona_di_piano ?? r.fields.area_di_piano).join("; ")}.`
      : "Il PRG non restituisce una zona sul punto controllato.",
    metrics: rows.flatMap((r, i) => [
      {
        key: `zone-${i}`,
        label: r.layer === "AreeDiPiano" ? "Area di piano" : "Zona di piano",
        value: r.fields.zona_di_piano ?? r.fields.area_di_piano,
      },
      { key: `subzone-${i}`, label: "Categoria dichiarata", value: r.fields.desc_dm_1444 ?? null },
      { key: `code-${i}`, label: "Codice del piano", value: r.fields.codice ?? r.fields.id_ap ?? null },
    ]),
    notes: [
      "PRG vigente del 1995; revisione del dataset dichiarata al 30 giugno 2025.",
      "Il Comune dichiara un regime di salvaguardia dal 16 marzo 2026 per il nuovo piano adottato: verificare anche le sue previsioni.",
      advice,
    ],
    method:
      "WMS 1.1.1 GetFeatureInfo text/plain, AreeDiPiano e ZonediPiano, EPSG:4326, bbox ±0,001°, pixel centrale 101×101. Identità comunale ISTAT/Belfiore; il piano adottato non è incluso.",
    provenance: [provenance("planning-torino", payload, { referenceDate: "2025-06-30" })],
  });
};

export const sienaPlanning: LayerProvider = async (plot, { signal }) => {
  const payload = await fetchSource(
    "planning-siena",
    wmsPointParams("piano_operativo_geometrie_r2", plot.centroid, 0.001),
    { signal, timeoutMs: 6500, retries: 0 },
  );
  const rows = parseGeo(payload).features.map((f) => {
    const parsed = z
      .object({
        id: z.number().int(),
        zto: z.string().nullable(),
        ambito: z.string().nullable(),
        sistemi: z.string().nullable(),
        interv: z.string().nullable(),
      })
      .safeParse(f.properties);
    if (!parsed.success) throw new UpstreamError("Attributi PO Siena non riconosciuti.");
    return parsed.data;
  });
  return layerResult("planning", {
    status: rows.length ? "ok" : "empty",
    scope: "point",
    severity: "unknown",
    headline: rows.length
      ? `Piano Operativo di Siena: ${rows.map((r) => [r.zto && `zona ${r.zto}`, r.ambito && `ambito ${r.ambito}`].filter(Boolean).join(", ") || `elemento ${r.id}`).join("; ")}.`
      : "Il Piano Operativo non restituisce una zona sul punto controllato.",
    metrics: rows.flatMap((r, i) => [
      { key: `zone-${i}`, label: "Zona territoriale omogenea", value: r.zto },
      { key: `subzone-${i}`, label: "Ambito", value: r.ambito },
      { key: `code-${i}`, label: "Codice elemento", value: String(r.id) },
      { key: `system-${i}`, label: "Sistema", value: r.sistemi },
      { key: `intervention-${i}`, label: "Codice intervento", value: r.interv },
    ]),
    notes: [
      "Geometrie del Piano Operativo con variante 1: il catalogo indica pubblicazione della variante il 31 maggio 2023.",
      "Il Comune pubblica anche varianti normative successive: la geometria non riassume tutte le regole vigenti.",
      advice,
    ],
    method:
      "WMS 1.1.1 GetFeatureInfo GeoJSON del layer piano_operativo_geometrie_r2; EPSG:4326, bbox ±0,001°, pixel centrale 101×101. Codici ZTO e ambito originali, senza interpretazione edificatoria.",
    provenance: [provenance("planning-siena", payload, { referenceDate: "2023-05-31" })],
  });
};
