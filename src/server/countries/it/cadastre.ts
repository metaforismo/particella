import { z } from "zod";
import { Plot as PlotSchema, type Plot } from "#contracts";
import { BadRequest, NotFound, ProtocolError, UpstreamError } from "#server/core/errors.ts";
import { cache, canonicalKey, NEGATIVE_TTL_MS } from "#server/core/cache.ts";
import { textBody } from "#server/core/http.ts";
import { provenance } from "#server/core/provenance.ts";
import { source } from "#server/core/sources.ts";
import {
  coversPoint,
  measurements,
  representativePoint,
  latLonBox,
  toCadastre,
  type PlotGeometry,
} from "#server/geo/index.ts";
import { wfsMembers, gmlGeometry } from "#server/geo/gml.ts";
import { fetchSource, queryUrl } from "#server/countries/it/queries.ts";
import { municipalityAt } from "#server/countries/it/municipality.ts";

export const PlotId = z
  .string()
  .regex(/^it:[A-Z][0-9]{3}:(?:_|[A-Z0-9]{1,3}):[0-9]{1,5}[A-Z]{0,2}:(?:[0-9]{1,8}[A-Z]?|[A-Z])$/);

export function parsePlotId(id: string) {
  const parsed = PlotId.safeParse(id);
  if (!parsed.success)
    throw new BadRequest(
      "Identificativo catastale non valido: usare it:Belfiore:sezione: foglio:particella senza spazi.",
    );
  const [, municipalityCode, section, sheet, parcel] = id.split(":");
  return { municipalityCode, section: section === "_" ? null : section, sheet, parcel };
}

const ParcelAttributes = z.object({
  ADMINISTRATIVEUNIT: z.string().regex(/^[A-Z][0-9]{3}$/),
  LABEL: z.string(),
  NATIONALCADASTRALREFERENCE: z.string(),
});

export interface Parcel {
  belfiore: string;
  parcel: string;
  reference: string;
  mapReference: string;
  geometry: PlotGeometry;
  special: boolean;
}

export function parseParcels(text: string, requireConfirmedEmpty = false): Parcel[] {
  return wfsMembers(text, requireConfirmedEmpty).map((node) => {
    const parsed = ParcelAttributes.safeParse(node);
    if (!parsed.success) throw new UpstreamError("Identificativi WFS catastali non validi.");
    const a = parsed.data;
    const match = a.NATIONALCADASTRALREFERENCE.match(/^([A-Z]\d{3}[A-Z0-9]*(?:_[A-Z0-9]+)?)\.([A-Z0-9]+)$/);
    if (!match || match[2] !== a.LABEL || match[1].slice(0, 4) !== a.ADMINISTRATIVEUNIT)
      throw new UpstreamError("Riferimento catastale incoerente.");
    return {
      belfiore: a.ADMINISTRATIVEUNIT,
      parcel: a.LABEL,
      reference: a.NATIONALCADASTRALREFERENCE,
      mapReference: match[1],
      geometry: gmlGeometry(node.msGeometry),
      special: /STRADA|ACQUA|STRAD|ACQUE/i.test(a.LABEL),
    };
  });
}

export interface Zoning {
  reference: string;
  sheet: string;
  belfiore: string;
  section: string | null;
}

/**
 * Map sheets in the response. Sheets can carry a letter suffix (e.g. "21C" for an attached
 * development); a sheet we cannot interpret is skipped rather than failing every lookup in its bbox.
 * Callers still fail when the sheet of the selected parcel is missing.
 */
export function parseZoning(text: string, requireConfirmedEmpty = false): Zoning[] {
  return wfsMembers(text, requireConfirmedEmpty).flatMap((n) => {
    const sheet = String(n.LABEL ?? "");
    const reference = String(n.NATIONALCADASTRALZONINGREFERENCE ?? "");
    // Legacy maps also arrive as H501A048500 / L736A0015DZ (no underscore).
    // Sheet always comes from LABEL and is matched to the selected parcel's exact map reference.
    const code =
      reference.match(/^([A-Z]\d{3})([A-Z0-9]{0,3})_[A-Z0-9]+$/) ??
      reference.match(/^([A-Z]\d{3})([A-Z]{0,3})[0-9]{4}[A-Z0-9]{2}$/);
    if (!code || !/^\d{1,5}[A-Z]{0,2}$/.test(sheet)) return [];
    return [{ reference, sheet, belfiore: code[1], section: code[2] || null }];
  });
}

function wfs(type: string, params: Record<string, string | number>) {
  // AdE zoning rejects COUNT=100 with an HTTP-200 OGC exception; 10 is verified live.
  return { SERVICE: "WFS", VERSION: "2.0.0", REQUEST: "GetFeature", TYPENAMES: type, COUNT: 10, ...params };
}

async function toPlot(
  parcel: Parcel,
  zoning: Zoning,
  payloads: { requestUrl: string; retrievedAt: string }[],
  municipalityLookup: Awaited<ReturnType<typeof municipalityAt>>,
): Promise<Plot> {
  if (parcel.special)
    throw new NotFound("Il punto ricade su una strada o un'acqua catastale: non è un lotto.");
  const id = `it:${parcel.belfiore}:${zoning.section ?? "_"}:${zoning.sheet}:${parcel.parcel}`;
  const municipality = municipalityLookup;
  const result = PlotSchema.parse({
    id,
    country: "it",
    cadastral: {
      municipalityCode: parcel.belfiore,
      section: zoning.section,
      sheet: zoning.sheet,
      parcel: parcel.parcel,
      label: `Foglio ${zoning.sheet} · Particella ${parcel.parcel}`,
    },
    municipality: { ...municipality.municipality, cadastralCode: parcel.belfiore },
    address: null,
    centroid: representativePoint(parcel.geometry),
    geometry: parcel.geometry,
    ...measurements(parcel.geometry),
    provenance: [
      provenance("ade-cadastre", payloads[0], {
        dataset: "Cartografia catastale — particelle",
      }),
      provenance("ade-cadastre", payloads[1], {
        dataset: "Mappe catastali — fogli",
      }),
      municipality.provenance,
      municipality.provinceProvenance,
    ],
  });
  await cache.set(canonicalKey("plot:v1", id), result, 86_400_000);
  return result;
}

export async function plotAt(lat: number, lon: number, signal?: AbortSignal): Promise<Plot> {
  const p = { lat, lon };
  const native = toCadastre(p);
  const municipality = await municipalityAt(p, null, signal);
  const parcelPayload = await spatialCadastre("CP:CadastralParcel", native, signal);
  const parcels = parseParcels(textBody(parcelPayload)).filter((parcel) => coversPoint(parcel.geometry, p));
  if (!parcels.length)
    throw new NotFound("Nessuna particella contiene questo punto; non viene scelto il lotto più vicino.");
  if (parcels.length !== 1)
    throw new BadRequest("Il punto è su un confine o su particelle sovrapposte: scegliere un punto interno.");
  if (parcels[0].special)
    throw new NotFound("Il punto ricade su una strada o un'acqua catastale: non è un lotto.");
  const zoningPayload = await spatialCadastre("CP:CadastralZoning", native, signal);
  const zoning = parseZoning(textBody(zoningPayload)).find((z) => z.reference === parcels[0].mapReference);
  if (!zoning)
    throw new UpstreamError(
      "La fonte non fornisce la mappa del lotto; il foglio non viene dedotto dal riferimento.",
    );
  return toPlot(parcels[0], zoning, [parcelPayload, zoningPayload], municipality);
}

async function spatialCadastre(
  type: "CP:CadastralParcel" | "CP:CadastralZoning",
  native: { lat: number; lon: number },
  signal?: AbortSignal,
) {
  // AdE can reject one spatial window with HTTP 200 / InvalidFormat while a smaller
  // window at the same point works. The selected parcel and map reference still must match.
  for (const delta of [0.0001, 0.00002]) {
    try {
      return await fetchSource(
        "ade-cadastre",
        wfs(type, { BBOX: `${latLonBox(native, delta)},urn:ogc:def:crs:EPSG::6706` }),
        { signal, timeoutMs: 8000 },
      );
    } catch (error) {
      if (!(error instanceof ProtocolError) || signal?.aborted) throw error;
      if (delta === 0.00002)
        throw new UpstreamError(
          "Il servizio catastale non riesce a leggere la mappa in questo punto. Riprovare più tardi o scegliere un altro punto interno allo stesso terreno.",
        );
    }
  }
  throw new UpstreamError();
}

function filter(property: string, value: string, sheet?: string): string {
  const equal = (key: string, literal: string) =>
    `<fes:PropertyIsEqualTo><fes:ValueReference>${key}</fes:ValueReference><fes:Literal>${literal}</fes:Literal></fes:PropertyIsEqualTo>`;
  const expression = sheet
    ? `<fes:And>${equal(property, value)}${equal("CP:LABEL", sheet)}</fes:And>`
    : equal(property, value);
  return `<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0" xmlns:CP="http://mapserver.gis.umn.edu/mapserver">${expression}</fes:Filter>`;
}

export async function plotById(id: string, signal?: AbortSignal): Promise<Plot> {
  const parts = parsePlotId(id);
  const key = canonicalKey("plot:v1", id);
  const cached = await cache.get<Plot | { missing: true }>(key);
  if (cached) {
    if ("missing" in cached) throw new NotFound();
    return cached;
  }
  const admin = `${parts.municipalityCode}${parts.section ?? ""}`;
  const zoningPayload = await fetchSource(
    "ade-cadastre",
    wfs("CP:CadastralZoning", {
      FILTER: filter("CP:ADMINISTRATIVEUNIT", parts.municipalityCode, parts.sheet),
    }),
    { signal, ttlMs: NEGATIVE_TTL_MS },
  );
  const maps = parseZoning(textBody(zoningPayload), true).filter(
    (z) =>
      z.belfiore === parts.municipalityCode &&
      z.section === parts.section &&
      z.sheet === parts.sheet &&
      z.reference.startsWith(admin),
  );
  if (maps.length !== 1) {
    await cache.set(key, { missing: true }, NEGATIVE_TTL_MS);
    throw new NotFound("Foglio catastale non trovato o ambiguo.");
  }
  const parcelPayload = await fetchSource(
    "ade-cadastre",
    wfs("CP:CadastralParcel", {
      FILTER: filter("CP:NATIONALCADASTRALREFERENCE", `${maps[0].reference}.${parts.parcel}`),
    }),
    { signal, ttlMs: NEGATIVE_TTL_MS },
  );
  const parcels = parseParcels(textBody(parcelPayload), true);
  const parcel = parcels.find((p) => p.reference === `${maps[0].reference}.${parts.parcel}`);
  if (!parcel) {
    await cache.set(key, { missing: true }, NEGATIVE_TTL_MS);
    throw new NotFound();
  }
  return toPlot(
    parcel,
    maps[0],
    [parcelPayload, zoningPayload],
    await municipalityAt(representativePoint(parcel.geometry), parcel.belfiore, signal),
  );
}

export const cadastreRequestExample = queryUrl(
  source("ade-cadastre").endpoint,
  wfs("CP:CadastralParcel", { BBOX: "43.6999,11.3199,43.7001,11.3201,urn:ogc:def:crs:EPSG::6706" }),
);
