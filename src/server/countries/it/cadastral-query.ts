import snapshot from "../../../../data/snapshots/it-municipalities.json" with { type: "json" };
import { BadRequest, NotFound } from "#server/core/errors.ts";

export interface CadastralQuery {
  municipality: string;
  sheet: string;
  parcel: string;
  section: string | null;
}

const marker = /\b(?:foglio|fg\.?|f\.|particella|part\.?|p\.|mappale|mapp\.?)(?=\s|[:=]|\d|$)/i;
const normalizeNumber = (value: string) => value.toUpperCase().replace(/^0+(?=\d)/, "");

/** Returns null only for ordinary text; incomplete cadastral intent is a 400. */
export function parseCadastralQuery(input: string): CadastralQuery | null {
  if (!marker.test(input)) return null;
  let rest = input.normalize("NFC").trim();
  function take(pattern: RegExp, required: boolean): string | null {
    const matches = [...rest.matchAll(pattern)];
    if (matches.length !== 1) {
      if (!required && matches.length === 0) return null;
      throw new BadRequest(
        "Ricerca catastale: indicare un Comune, un foglio e una particella; sezione facoltativa.",
      );
    }
    rest = rest.replace(pattern, " ");
    return required ? normalizeNumber(matches[0][1]) : matches[0][1].toUpperCase();
  }
  const sheet = take(/\b(?:foglio|fg\.?|f\.)\s*[:=]?\s*(\d{1,5}[a-z]{0,2})(?=\s|,|;|$)/gi, true)!;
  const parcel = take(
    /\b(?:particella|part\.?|p\.|mappale|mapp\.?)\s*[:=]?\s*(\d{1,8}[a-z]?|[a-z])(?=\s|,|;|$)/gi,
    true,
  )!;
  const section = take(/\b(?:sezione|sez\.?)\s*[:=]?\s*([a-z0-9]{1,3})(?=\s|,|;|$)/gi, false);
  const municipality = rest
    .replace(/\bcomune\s+(?:di\s+)?/gi, " ")
    .replace(/[,;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!municipality || /\d/.test(municipality))
    throw new BadRequest("Indicare il nome completo del Comune nella ricerca catastale.");
  return { municipality, sheet, parcel, section };
}

const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’']/g, " ")
    .replace(/[-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export function resolveMunicipality(name: string) {
  const province = name.match(/(?:\(([a-z]{2})\)|\s+([a-z]{2}))$/i);
  const candidates = (query: string) =>
    snapshot.municipalities.filter((m) =>
      [m.name, ...m.aliases].some((a) => normalized(a) === normalized(query)),
    );
  let matches = candidates(name);
  if (!matches.length && province)
    matches = candidates(name.slice(0, province.index).trim()).filter(
      (m) => m.provinceCode === (province[1] ?? province[2]).toUpperCase(),
    );
  if (!matches.length) throw new NotFound(`Comune «${name}» non trovato nello snapshot ISTAT.`);
  if (matches.length > 1)
    throw new BadRequest(
      `Comune ambiguo: ${matches.map((m) => `${m.name} (${m.provinceCode}) — ${m.cadastralCode}`).join("; ")}. Specificare la provincia.`,
    );
  if (!/^[A-Z]\d{3}$/.test(matches[0].cadastralCode))
    throw new NotFound("Codice Belfiore non disponibile per questo Comune.");
  return matches[0];
}

export const municipalitySnapshot = snapshot;
