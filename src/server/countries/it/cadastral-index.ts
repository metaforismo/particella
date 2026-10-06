import { Readable } from "node:stream";
import { createInflateRaw, crc32 } from "node:zlib";
import { readFile, writeFile, mkdir, rename, readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { BadRequest, NotFound, UpstreamError } from "#server/core/errors.ts";
import { parseZoning } from "#server/countries/it/cadastre.ts";
import {
  zipDirectory,
  downloadMunicipalArchive,
  type ZipEntry,
} from "#server/countries/it/cadastral-archive.ts";
import { resolveMunicipality, municipalitySnapshot } from "#server/countries/it/cadastral-query.ts";

const Bbox = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
const Index = z.object({
  version: z.literal(1),
  belfiore: z.string().regex(/^[A-Z]\d{3}$/),
  requestUrl: z.url(),
  retrievedAt: z.iso.datetime(),
  referenceDate: z.string(),
  sha256: z.string().length(64),
  maps: z.array(
    z.object({
      reference: z.string(),
      sheet: z.string(),
      belfiore: z.string(),
      section: z.string().nullable(),
    }),
  ),
  parcels: z.record(z.string(), z.array(Bbox)),
  counts: z.object({ maps: z.number(), parcels: z.number() }),
});
export type CadastralIndex = z.infer<typeof Index>;
const TTL = 7 * 86400000;
const root = () =>
  process.env.PARTICELLA_CADASTRAL_INDEX_DIR ?? join(tmpdir(), "particella-cadastral-index-v1");
const pending = new Map<string, Promise<CadastralIndex>>();

async function members(archive: Uint8Array, entry: ZipEntry, consume: (member: string) => void) {
  const b = Buffer.from(archive),
    o = entry.offset;
  if (
    entry.size > 512 * 1024 * 1024 ||
    o + 30 > b.length ||
    b.readUInt32LE(o) !== 0x04034b50 ||
    entry.method !== 8
  )
    throw new UpstreamError("GML comunale ZIP non supportato.");
  const start = o + 30 + b.readUInt16LE(o + 26) + b.readUInt16LE(o + 28);
  if (start + entry.compressed > b.length) throw new UpstreamError("GML comunale ZIP troncato.");
  const stream = Readable.from(b.subarray(start, start + entry.compressed)).pipe(createInflateRaw());
  const decoder = new TextDecoder("utf8", { fatal: true });
  let buffer = "",
    header = "",
    expected: number | undefined,
    count = 0,
    size = 0,
    checksum = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    checksum = crc32(chunk, checksum);
    if (size > entry.size) throw new UpstreamError("GML espanso oltre la dimensione dichiarata.");
    buffer += decoder.decode(chunk, { stream: true });
    if (expected === undefined) {
      const end = buffer.indexOf("<wfs:member>");
      if (end < 0 && buffer.length < 65536) continue;
      header = buffer.slice(0, end < 0 ? buffer.length : end);
      const n = header.match(/numberReturned="(\d+)"/),
        matched = header.match(/numberMatched="(\d+)"/);
      if (!n || !matched || n[1] !== matched[1] || header.includes("<!DOCTYPE"))
        throw new UpstreamError("Archivio GML non confermato completo.");
      expected = Number(n[1]);
    }
    while (true) {
      const a = buffer.indexOf("<wfs:member>"),
        end = buffer.indexOf("</wfs:member>", a);
      if (a < 0 || end < 0) break;
      consume(buffer.slice(a, end + 13));
      count++;
      buffer = buffer.slice(end + 13);
    }
    if (buffer.length > 4 * 1024 * 1024) throw new UpstreamError("Elemento GML oltre 4 MiB.");
  }
  buffer += decoder.decode();
  if (
    size !== entry.size ||
    checksum !== b.readUInt32LE(o + 14) ||
    count !== expected ||
    !buffer.includes("</wfs:FeatureCollection>")
  )
    throw new UpstreamError("Archivio GML troncato o checksum non valido.");
  return { count, referenceDate: header.match(/timeStamp="([^"]+)"/)?.[1] ?? "non dichiarata" };
}

/** Complete municipal GML -> exact map labels + parcel bboxes; no geometries retained. */
export async function buildCadastralIndex(
  archive: Uint8Array,
  belfiore: string,
  metadata: { requestUrl: string; retrievedAt: string },
): Promise<CadastralIndex> {
  const entries = zipDirectory(archive);
  const map = entries.find((e) => e.name.startsWith(`${belfiore}_`) && e.name.endsWith("_map.gml"));
  const parcel = entries.find((e) => e.name.startsWith(`${belfiore}_`) && e.name.endsWith("_ple.gml"));
  if (!map || !parcel) throw new UpstreamError("GML comunale di fogli e particelle mancante.");
  const maps: CadastralIndex["maps"] = [],
    parcels: CadastralIndex["parcels"] = {};
  const mapInfo = await members(archive, map, (member) =>
    maps.push(...parseZoning(`<wfs:FeatureCollection>${member}</wfs:FeatureCollection>`)),
  );
  if (maps.some((m) => m.belfiore !== belfiore))
    throw new UpstreamError("Mappe di un altro Comune nell'archivio.");
  const parcelInfo = await members(archive, parcel, (member) => {
    const reference = member.match(/<CP:NATIONALCADASTRALREFERENCE>([^<]+)<\//)?.[1];
    const admin = member.match(/<CP:ADMINISTRATIVEUNIT>([^<]+)<\//)?.[1];
    const label = member.match(/<CP:LABEL>([^<]+)<\//)?.[1];
    if (
      !reference ||
      admin !== belfiore ||
      !label ||
      !reference.endsWith(`.${label}`) ||
      !reference.startsWith(belfiore)
    )
      throw new UpstreamError("Identificativi comunali incoerenti nel GML.");
    if (!/^(?:\d{1,8}[A-Z]?|[A-Z])$/.test(label)) return;
    const low = member
      .match(/<gml:lowerCorner>([^<]+)<\//)?.[1]
      .trim()
      .split(/\s+/)
      .map(Number);
    const high = member
      .match(/<gml:upperCorner>([^<]+)<\//)?.[1]
      .trim()
      .split(/\s+/)
      .map(Number);
    if (!low || !high || low.length !== 2 || high.length !== 2)
      throw new UpstreamError("Bbox catastale mancante.");
    const bbox = Bbox.parse([low[1], low[0], high[1], high[0]]);
    if (bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) throw new UpstreamError("Bbox catastale vuota.");
    parcels[reference] = [...(parcels[reference] ?? []), bbox];
  });
  return Index.parse({
    version: 1,
    belfiore,
    ...metadata,
    referenceDate: parcelInfo.referenceDate,
    sha256: createHash("sha256").update(archive).digest("hex"),
    maps,
    parcels,
    counts: { maps: mapInfo.count, parcels: parcelInfo.count },
  });
}

export function findIndexedParcel(
  index: CadastralIndex,
  sheet: string,
  parcel: string,
  section: string | null,
  exactSection = false,
) {
  const sheets = index.maps.filter(
    (m) => m.sheet === sheet && ((section === null && !exactSection) || m.section === section),
  );
  if (!sheets.length)
    throw new NotFound(
      `Foglio ${sheet}${section ? `, sezione ${section}` : ""} non presente nel download AdE (${index.referenceDate}).`,
    );
  const matches = sheets.flatMap((map) =>
    (index.parcels[`${map.reference}.${parcel}`] ?? []).map((bbox) => ({
      map,
      bbox,
      reference: `${map.reference}.${parcel}`,
    })),
  );
  if (!matches.length)
    throw new NotFound(
      `Particella ${parcel} del foglio ${sheet} non presente nel download AdE (${index.referenceDate}).`,
    );
  if (matches.length !== 1)
    throw new BadRequest(
      `Ricerca catastale ambigua: ${matches.map(({ map }) => `sezione ${map.section ?? "senza sezione"}, foglio ${map.sheet}`).join("; ")}. Specificare la sezione o scegliere sulla mappa.`,
    );
  return matches[0];
}

export async function storeCadastralIndex(index: CadastralIndex) {
  await mkdir(root(), { recursive: true });
  // Own index files only: at most 256 MiB on disk. Atomic replacement keeps readers safe.
  const files = await Promise.all(
    (await readdir(root()))
      .filter((n) => /^[A-Z]\d{3}\.json$/.test(n))
      .map(async (name) => ({ name, info: await stat(join(root(), name)) })),
  );
  let size = files.reduce((s, f) => s + f.info.size, 0);
  for (const f of files.sort((a, b) => a.info.mtimeMs - b.info.mtimeMs)) {
    if (size < 240 * 1024 * 1024) break;
    await unlink(join(root(), f.name));
    size -= f.info.size;
  }
  const data = JSON.stringify(index);
  if (Buffer.byteLength(data) > 16 * 1024 * 1024)
    throw new UpstreamError("Indice comunale oltre il limite di 16 MiB.");
  const temporary = join(root(), `${index.belfiore}-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, data, { flag: "wx" });
    await rename(temporary, join(root(), `${index.belfiore}.json`));
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

export async function municipalIndex(belfiore: string, signal?: AbortSignal): Promise<CadastralIndex> {
  if (!/^[A-Z]\d{3}$/.test(belfiore)) throw new BadRequest("Codice Belfiore non valido.");
  try {
    const path = join(root(), `${belfiore}.json`),
      info = await stat(path);
    if (info.size <= 16 * 1024 * 1024 && Date.now() - info.mtimeMs < TTL) {
      const index = Index.parse(JSON.parse(await readFile(path, "utf8")));
      if (index.belfiore === belfiore) return index;
    }
  } catch {
    /* Missing, expired or invalid index is regenerated from the official archive. */
  }
  const existing = pending.get(belfiore);
  if (existing) return existing;
  const task = (async () => {
    const municipality = municipalitySnapshot.municipalities.find((m) => m.cadastralCode === belfiore);
    if (!municipality) throw new NotFound("Comune catastale non disponibile nello snapshot ISTAT.");
    if (["TN", "BZ"].includes(municipality.provinceCode))
      throw new UpstreamError("Il download AdE non copre Trento e Bolzano.");
    // Verify the same name/code relationship used by the query resolver.
    resolveMunicipality(`${municipality.name} (${municipality.provinceCode})`);
    const archive = await downloadMunicipalArchive(
      municipality.region,
      municipality.provinceCode,
      belfiore,
      signal,
    );
    const index = await buildCadastralIndex(archive.bytes, belfiore, archive);
    await storeCadastralIndex(index);
    return index;
  })().finally(() => pending.delete(belfiore));
  pending.set(belfiore, task);
  return task;
}
