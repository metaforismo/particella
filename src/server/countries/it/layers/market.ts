import { formatNumber } from "#server/core/format.ts";
import { z } from "zod";
import { unzipSync } from "fflate";
import { layerResult, type LayerProvider } from "#server/core/layers.ts";
import { provenance } from "#server/core/provenance.ts";
import { source } from "#server/core/sources.ts";
import { http, jsonBody, textBody } from "#server/core/http.ts";
import { fetchSource, queryUrl } from "#server/countries/it/queries.ts";
import { xmlDocument, list } from "#server/geo/gml.ts";
import { coversPoint, type PlotGeometry } from "#server/geo/index.ts";
import { UpstreamError } from "#server/core/errors.ts";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

function kmlRing(value: unknown): number[][] {
  const coordinates = record(record(value).LinearRing).coordinates;
  const rows = String(coordinates ?? "")
    .trim()
    .split(/\s+/)
    .map((row) => row.split(",").slice(0, 2).map(Number));
  const parsed = z
    .array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
    .min(4)
    .safeParse(rows);
  if (!parsed.success || rows[0][0] !== rows.at(-1)![0] || rows[0][1] !== rows.at(-1)![1])
    throw new UpstreamError("Confine OMI non valido.");
  return parsed.data;
}

function kmlPolygons(node: Record<string, unknown>): number[][][][] {
  if (node.Polygon)
    return list(node.Polygon).map((value) => {
      const polygon = record(value);
      return [kmlRing(polygon.outerBoundaryIs), ...list(polygon.innerBoundaryIs).map(kmlRing)];
    });
  return list(node.MultiGeometry).flatMap((value) => kmlPolygons(record(value)));
}

export function parseOmiKml(bytes: Uint8Array) {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (file) => /\.kml$/i.test(file.name) && file.originalSize <= 12_000_000,
    });
  } catch {
    throw new UpstreamError("Archivio OMI non valido.");
  }
  const entries = Object.values(files);
  if (entries.length !== 1) throw new UpstreamError("Archivio OMI senza un unico KML valido.");
  const root = record(record(xmlDocument(new TextDecoder().decode(entries[0])).kml).Document);
  const placemarks = list(root.Placemark);
  if (!placemarks.length) throw new UpstreamError("Zone OMI mancanti nell’archivio.");
  return placemarks.map((value) => {
    const placemark = record(value);
    const data = Object.fromEntries(
      list(record(placemark.ExtendedData).Data).map((entry) => {
        const r = record(entry);
        return [String(r["@_name"]), String(r.value ?? "")];
      }),
    );
    if (!/^[A-Z]\d{3}$/.test(data.CODCOM ?? "") || !/^[A-Z]\d{1,3}$/.test(data.CODZONA ?? ""))
      throw new UpstreamError("Identificativi OMI non validi.");
    const polygons = kmlPolygons(placemark);
    if (!polygons.length) throw new UpstreamError("Geometria OMI mancante.");
    const geometry: PlotGeometry =
      polygons.length === 1
        ? { type: "Polygon", coordinates: polygons[0] }
        : { type: "MultiPolygon", coordinates: polygons };
    return { municipalityCode: data.CODCOM, zone: data.CODZONA, geometry };
  });
}

const cleanHtml = (text: string) =>
  text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

export function parseOmiPrices(text: string, expected?: { code: string; zone: string; semester: string }) {
  const plain = cleanHtml(text);
  if (
    expected &&
    (!plain.includes(`(${expected.code})`) ||
      !new RegExp(`Codice zona: ${expected.zone}\\b`).test(plain) ||
      !new RegExp(`Anno ${expected.semester.slice(0, 4)}.*Semestre ${expected.semester[4]}`).test(plain))
  )
    throw new UpstreamError("Quotazioni OMI riferite a un’altra zona o semestre.");
  const predominant = plain.match(/Tipologia prevalente:\s*(.*?)\s*Destinazione prevalente:/i)?.[1];
  if (!plain.includes("Codice zona:") || !/<table\b/i.test(text) || !plain.includes("Valori compravendita"))
    throw new UpstreamError("Tabella delle quotazioni OMI non riconosciuta.");
  const residential = /^(Abitazioni|Ville|Villini)\b/i;
  const hasPredominant = Boolean(predominant && residential.test(predominant));
  const rows = [...text.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap((match) => {
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => cleanHtml(m[1]));
    if (cells.length !== 8 || !residential.test(cells[0]) || (hasPredominant && cells[0] !== predominant))
      return [];
    const min = Number(cells[2].replace(/\./g, "").replace(",", "."));
    const max = Number(cells[3].replace(/\./g, "").replace(",", "."));
    if (
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min <= 0 ||
      max < min ||
      !["L", "N"].includes(cells[4])
    )
      throw new UpstreamError("Valori OMI non validi.");
    return [
      { type: cells[0], condition: cells[1], min, max, surface: cells[4], isPredominant: hasPredominant },
    ];
  });
  return rows;
}

export const market: LayerProvider = async (plot, { signal }) => {
  const code = plot.cadastral.municipalityCode;
  const province = plot.municipality?.provinceCode;
  if (!province || !/^[A-Z]{2}$/.test(province))
    return layerResult("market", {
      status: "outside_coverage",
      scope: "zone",
      headline: "La zona OMI non è ancora collegata per questo Comune.",
      notes: ["Non è disponibile una sigla provinciale confermata per interrogare la fonte."],
    });
  const semesterPayload = await fetchSource("omi", { richiesta: 5 }, { signal, ttlMs: 86_400_000 });
  const semesters = z
    .array(z.object({ SEMESTRE: z.string().regex(/^20\d{2}[12]$/) }))
    .safeParse(jsonBody(semesterPayload));
  if (!semesters.success || !semesters.data.length)
    throw new UpstreamError("Elenco semestri OMI non valido.");
  const semester = semesters.data
    .map((r) => r.SEMESTRE)
    .sort()
    .at(-1)!;
  const s = source("omi");
  const perimeterUrl = queryUrl(new URL("perimetri.php", s.endpoint).toString(), {
    id: 1,
    prov: province,
    codcom: code,
    semestre: semester,
    formato: "kml",
  });
  const perimeterPayload = await http.request(perimeterUrl, { signal, sourceId: s.id, policy: s.hostPolicy });
  const allZones = parseOmiKml(perimeterPayload.bytes);
  if (allZones.some((z) => z.municipalityCode !== code))
    throw new UpstreamError("Perimetri OMI di un altro Comune.");
  const matches = allZones.filter((z) => coversPoint(z.geometry, plot.centroid));
  const ids = [...new Set(matches.map((z) => z.zone))];
  if (!ids.length)
    return layerResult("market", {
      status: "empty",
      scope: "zone",
      headline: "OMI non restituisce una zona sul punto del terreno.",
      notes: ["Un risultato vuoto non equivale a un valore immobiliare nullo."],
      provenance: [provenance("omi", perimeterPayload, { referenceDate: semester })],
    });
  if (ids.length !== 1) throw new UpstreamError("Il punto ricade su più zone OMI: selezione ambigua.");
  const zone = ids[0];
  const zoneListPayload = await fetchSource(
    "omi",
    { richiesta: 3, codcom: code, semestre: semester },
    { signal },
  );
  const zoneList = z
    .array(
      z.object({ LINK_ZONA: z.string().regex(/^[A-Z]{2}\d{8}$/), ZONA: z.string(), DIZIONE: z.string() }),
    )
    .safeParse(jsonBody(zoneListPayload));
  const selected = zoneList.success ? zoneList.data.find((r) => r.ZONA === zone) : undefined;
  if (!selected) throw new UpstreamError("Descrizione della zona OMI non disponibile.");
  const priceUrl =
    new URL("stampaomi.php", s.endpoint).toString() +
    `?${code}/${selected.LINK_ZONA}/${semester}/R/${zone}/${plot.centroid.lon}/${plot.centroid.lat}`;
  const pricesPayload = await http.request(priceUrl, {
    signal,
    sourceId: s.id,
    policy: s.hostPolicy,
    validate: (p) => {
      parseOmiPrices(textBody(p), { code, zone, semester });
    },
  });
  const prices = parseOmiPrices(textBody(pricesPayload), { code, zone, semester });
  return layerResult("market", {
    scope: "zone",
    status: !prices.length ? "empty" : prices.every((p) => p.isPredominant) ? "ok" : "partial",
    severity: "none",
    headline: !prices.length
      ? `La zona OMI ${zone} non pubblica quotazioni residenziali.`
      : !prices[0].isPredominant
        ? `La zona OMI ${zone} pubblica quotazioni senza indicare una tipologia residenziale prevalente.`
        : `Nella zona OMI ${zone}, ${prices[0].type.toLowerCase()} da ${formatNumber(Math.min(...prices.map((p) => p.min)))} a ${formatNumber(Math.max(...prices.map((p) => p.max)))} €/m².`,
    metrics: [
      { key: "omi_zone", label: "Zona OMI", value: `${zone} · ${selected.DIZIONE}` },
      {
        key: "semester",
        label: "Semestre pubblicato più recente",
        value: `${semester.slice(0, 4)}/${semester[4]}`,
      },
      ...prices.flatMap((p, i) => [
        {
          key: `residential-${i}-min`,
          label: `${p.type} (${p.condition}): minimo`,
          value: p.min,
          unit: "€/m²",
          hint: p.surface === "L" ? "Superficie lorda" : "Superficie netta",
        },
        {
          key: `residential-${i}-max`,
          label: `${p.type} (${p.condition}): massimo`,
          value: p.max,
          unit: "€/m²",
        },
      ]),
    ],
    features: {
      type: "FeatureCollection",
      features: matches.map((z) => ({
        type: "Feature",
        geometry: z.geometry,
        properties: { classKey: "omi-zone", zone },
      })),
    },
    legend: [{ classKey: "omi-zone", label: `Zona OMI ${zone}` }],
    method:
      "Elenco semestri live; KML ufficiale per Comune, point-in-polygon sul punto rappresentativo, quindi elenco zone e tabella HTML residenziale. Stato conservativo e superficie L/N mantenuti; nessun valore dedotto per il terreno.",
    notes: [
      ...(!prices.length
        ? ["La fonte ha risposto, ma non pubblica prezzi residenziali per questa zona e semestre."]
        : !prices[0].isPredominant
          ? [
              "La fonte non indica una tipologia residenziale prevalente; sono mostrate tutte quelle disponibili.",
            ]
          : []),
      "Questi sono valori di zona per abitazioni, non una stima del lotto o il prezzo di un terreno.",
      "Il punto interno identifica la zona; un lotto esteso può attraversare più zone. Le condizioni del singolo immobile possono cambiare molto il prezzo.",
      "Il semestre è l’ultimo pubblicato dalla fonte, anche quando risale a un anno precedente.",
    ],
    provenance: [semesterPayload, perimeterPayload, zoneListPayload, pricesPayload].map((p) =>
      provenance("omi", p, { referenceDate: `${semester.slice(0, 4)}/${semester[4]}` }),
    ),
  });
};
