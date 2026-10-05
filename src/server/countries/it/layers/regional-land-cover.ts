import { z } from "zod";
import type { LayerProvider } from "#server/core/layers.ts";
import { layerResult } from "#server/core/layers.ts";
import { OutsideCoverage, UpstreamError } from "#server/core/errors.ts";
import { provenance } from "#server/core/provenance.ts";
import { textBody } from "#server/core/http.ts";
import { arcPointParams, fetchSource, parseArc, wmsPointParams } from "#server/countries/it/queries.ts";

// MapServer's advertised identify format is text/plain, not its GetMap JSON format.
export function parseMapServerInfo(text: string, layer: string): Record<string, string>[] {
  if (!text.startsWith("GetFeatureInfo results:"))
    throw new UpstreamError("Risposta cartografica non valida.");
  if (/^GetFeatureInfo results:\s+Search returned no results\.\s*$/.test(text)) return [];
  if (!text.includes(`Layer '${layer}'`)) throw new UpstreamError("Livello cartografico inatteso.");
  const blocks = text.split(/\n\s*Feature \d+:\s*\n/).slice(1);
  if (!blocks.length || blocks.length >= 100) throw new UpstreamError("Identificazione incompleta.");
  return blocks.map((block) => {
    const pairs = [...block.matchAll(/^\s+([\w]+) = '(.*)'\s*$/gm)];
    if (!pairs.length) throw new UpstreamError("Attributi cartografici non validi.");
    return Object.fromEntries(pairs.map(([, key, value]) => [key, value]));
  });
}

const TuscanyClass = z.object({ ucs2019: z.string().regex(/^\d{3,5}$/), des2019: z.string().min(1) });

const DusafClass = z.object({ DESCR: z.string().regex(/^\d{3,5}\s*[-–]/) });

export function parseUcs(text: string) {
  return parseMapServerInfo(text, "rt_ucs.iducs.10k.2019.rt.full").map((row) => {
    const parsed = TuscanyClass.safeParse(row);
    if (!parsed.success) throw new UpstreamError("Classe UCS mancante o non valida.");
    return { code: parsed.data.ucs2019, label: parsed.data.des2019 };
  });
}

export function parseDusaf(rows: Record<string, unknown>[]) {
  return rows.map((row) => {
    const parsed = DusafClass.safeParse(row);
    if (!parsed.success) throw new UpstreamError("Classe DUSAF mancante o non valida.");
    const match = parsed.data.DESCR.match(/^(\d{3,5})\s*[-–]\s*(.+)$/);
    if (!match) throw new UpstreamError("Descrizione DUSAF non valida.");
    return { code: match[1], label: match[2] };
  });
}

export const regionalLandCover: LayerProvider = async (plot, { signal }) => {
  const region = plot.municipality?.region;
  if (region !== "Toscana" && region !== "Lombardia") throw new OutsideCoverage();
  const id = region === "Toscana" ? "toscana-ucs" : "lombardia-dusaf";
  const payload = await fetchSource(
    id,
    region === "Toscana"
      ? {
          ...wmsPointParams("rt_ucs.iducs.10k.2019.rt.full", plot.centroid, 0.00001),
          info_format: "text/plain",
        }
      : arcPointParams(plot.centroid),
    { signal, timeoutMs: 12_000, retries: 1 },
  );
  const rows =
    region === "Toscana"
      ? parseUcs(textBody(payload))
      : parseDusaf(parseArc(payload).features.map((f) => f.attributes));
  const classes = [...new Map(rows.map((c) => [c.code, c])).values()];
  return layerResult("regional-land-cover", {
    status: classes.length > 1 ? "partial" : classes.length ? "ok" : "empty",
    scope: "point",
    severity: "none",
    headline:
      classes.length === 1
        ? `La carta regionale indica: ${classes[0].label.toLowerCase()}.`
        : classes.length
          ? "La carta regionale restituisce più classi sul punto: verificare il confine."
          : "La carta regionale non restituisce una classe sul punto controllato.",
    metrics: classes.flatMap((c) => [
      { key: `class-${c.code}`, label: "Uso del suolo sul punto", value: c.label },
      { key: `code-${c.code}`, label: "Codice regionale", value: c.code },
    ]),
    features: {
      type: "FeatureCollection",
      features: classes.map((c) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [plot.centroid.lon, plot.centroid.lat] },
        properties: { classKey: `cover-${c.code}`, label: c.label },
      })),
    },
    legend: classes.map((c) => ({ classKey: `cover-${c.code}`, label: c.label })),
    method:
      region === "Toscana"
        ? "UCS 2019 1:10.000; GetFeatureInfo WMS 1.1.1 sul punto rappresentativo, EPSG:4326, bbox ±0.00001°, 101×101, pixel 50,50; attributi ucs2019/des2019."
        : "DUSAF 7.0 (2021), scala 1:10.000; ArcGIS REST layer 1, esriSpatialRelIntersects sul punto rappresentativo EPSG:4326; attributo DESCR. Unità minima cartografabile 1.600 m² / 20 m.",
    notes: [
      "La classe riguarda il punto controllato, non la superficie di tutto il terreno.",
      "La carta descrive una copertura passata e non certifica l’uso attuale né la destinazione urbanistica.",
      "Una classe urbana non misura la percentuale impermeabilizzata. Questa percentuale non è disponibile.",
      ...(classes.length > 1 ? ["Il punto può trovarsi sul confine fra classi diverse."] : []),
    ],
    provenance: [provenance(id, payload)],
  });
};
