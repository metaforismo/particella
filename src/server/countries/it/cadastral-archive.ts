/** Bounded reads of the official regional ZIP; stop inflating the province after the requested Comune. */
import { Readable } from "node:stream";
import { createInflateRaw, inflateRawSync, crc32 } from "node:zlib";
import { UpstreamError } from "#server/core/errors.ts";
import { MemoryHostLimiter } from "#server/core/http.ts";

import { recordSource } from "#server/core/source-status.ts";
import { sourceLog } from "#server/core/observability.ts";

export interface ZipEntry {
  name: string;
  compressed: number;
  size: number;
  offset: number;
  method: number;
}
const fail = (message: string): never => {
  throw new UpstreamError(message);
};
const MAX_ZIP = 64 * 1024 * 1024;
const MAX_TRANSFER = 256 * 1024 * 1024;
const MAX_INFLATED = 512 * 1024 * 1024;
const limiter = new MemoryHostLimiter();

export function zipDirectory(bytes: Uint8Array, absoluteStart = 0): ZipEntry[] {
  const b = Buffer.from(bytes);
  let e = b.length - 22;
  while (e >= 0 && b.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0 || b.readUInt16LE(e + 4) || b.readUInt16LE(e + 6))
    return fail("Indice ZIP ufficiale non supportato.");
  const count = b.readUInt16LE(e + 10),
    size = b.readUInt32LE(e + 12);
  let at = b.readUInt32LE(e + 16) - absoluteStart;
  if (count === 65535 || at < 0 || at + size > e) return fail("Indice ZIP64 o troncato non supportato.");
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (at + 46 > e || b.readUInt32LE(at) !== 0x02014b50) return fail("Directory ZIP non valida.");
    const n = b.readUInt16LE(at + 28),
      x = b.readUInt16LE(at + 30),
      c = b.readUInt16LE(at + 32);
    if (at + 46 + n + x + c > e || b.readUInt16LE(at + 8) & 1)
      return fail("Archivio catastale cifrato o troncato.");
    entries.push({
      name: b.subarray(at + 46, at + 46 + n).toString("utf8"),
      method: b.readUInt16LE(at + 10),
      compressed: b.readUInt32LE(at + 20),
      size: b.readUInt32LE(at + 24),
      offset: b.readUInt32LE(at + 42),
    });
    at += 46 + n + x + c;
  }
  return entries;
}

export function zipMember(bytes: Uint8Array, entry: ZipEntry): Uint8Array {
  const b = Buffer.from(bytes),
    o = entry.offset;
  if (o + 30 > b.length || b.readUInt32LE(o) !== 0x04034b50 || entry.size > MAX_INFLATED)
    return fail("Membro ZIP non valido o troppo grande.");
  const start = o + 30 + b.readUInt16LE(o + 26) + b.readUInt16LE(o + 28);
  if (start + entry.compressed > b.length) return fail("Membro ZIP troncato.");
  const input = b.subarray(start, start + entry.compressed);
  const output =
    entry.method === 0
      ? input
      : entry.method === 8
        ? inflateRawSync(input, { maxOutputLength: MAX_INFLATED })
        : fail("Compressione ZIP non supportata.");
  if (output.length !== entry.size || crc32(output) !== b.readUInt32LE(o + 14))
    return fail("Dimensione del membro ZIP incoerente.");
  return output;
}

const regionFiles: Record<string, string> = {
  "Valle d'Aosta/Vallée d'Aoste": "VALLE-AOSTA",
  "Valle d'Aosta": "VALLE-AOSTA",
  "Emilia-Romagna": "EMILIA-ROMAGNA",
  "Friuli-Venezia Giulia": "FRIULI-VENEZIA-GIULIA",
};
export function archiveUrl(region: string): string {
  const file = regionFiles[region] ?? region.toUpperCase();
  if (!/^[A-Z-]+$/.test(file)) return fail("Regione non supportata dal download catastale.");
  return `https://wfs.cartografia.agenziaentrate.gov.it/inspire/wfs/GetDataset.php?dataset=${file}.zip`;
}

async function range(url: string, value: string, signal: AbortSignal) {
  const response = await fetch(url, { headers: { Range: `bytes=${value}` }, signal });
  if (response.status !== 206 || !/^bytes \d+-\d+\/\d+$/.test(response.headers.get("content-range") ?? "")) {
    await response.body?.cancel();
    return fail("Il download ufficiale non conferma una risposta parziale ZIP; riprovare più tardi.");
  }
  if (!response.url.startsWith("https://wfs-download.cartografia.agenziaentrate.eu/wfsdownload/")) {
    await response.body?.cancel();
    return fail("Destinazione del download catastale non riconosciuta.");
  }
  return response;
}

export async function downloadMunicipalArchive(
  region: string,
  provinceCode: string,
  code: string,
  signal?: AbortSignal,
) {
  const url = archiveUrl(region),
    started = performance.now();
  const controller = new AbortController();
  const deadline = AbortSignal.any([
    controller.signal,
    AbortSignal.timeout(180_000),
    ...(signal ? [signal] : []),
  ]);
  const release = await limiter.acquire("ade-download", { concurrency: 1, requestsPerSecond: 1 }, deadline);
  let transferred = 0;
  let succeeded = false;
  try {
    const tail = await range(url, "-65536", deadline);
    const contentRange = tail.headers.get("content-range")!;
    const start = Number(contentRange.match(/^bytes (\d+)/)![1]);
    const tailBytes = new Uint8Array(await tail.arrayBuffer());
    if (tailBytes.length > 65536) return fail("Indice ZIP troppo grande.");
    transferred += tailBytes.length;
    const entry = zipDirectory(tailBytes, start).find((e) => e.name === `${provinceCode}.zip`);
    if (!entry)
      return fail(
        "Provincia non presente nell'archivio ufficiale regionale (possibile variazione amministrativa).",
      );
    if (entry.size > MAX_INFLATED || entry.method !== 8)
      return fail("Archivio provinciale oltre il limite di 512 MiB o compressione non supportata.");
    const header = await range(url, `${entry.offset}-${entry.offset + 1023}`, deadline);
    const h = Buffer.from(await header.arrayBuffer());
    transferred += h.length;
    if (h.length > 1024 || h.readUInt32LE(0) !== 0x04034b50)
      return fail("Intestazione ZIP provinciale non valida.");
    const offset = entry.offset + 30 + h.readUInt16LE(26) + h.readUInt16LE(28);
    const response = await range(url, `${offset}-${offset + entry.compressed - 1}`, deadline);
    if (!response.body) return fail("Download catastale privo di contenuto.");
    const inflater = createInflateRaw();
    const compressed = Readable.from(
      (async function* () {
        const reader = response.body!.getReader();
        try {
          while (true) {
            const { value: chunk, done } = await reader.read();
            if (done) break;
            transferred += chunk.length;
            if (transferred > MAX_TRANSFER)
              return fail("Download oltre il limite di 256 MiB; preparare l'indice comunale offline.");
            yield chunk;
          }
        } finally {
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }
      })(),
    );
    compressed.on("error", (e) => inflater.destroy(e));
    compressed.pipe(inflater);
    const iterator = inflater[Symbol.asyncIterator]();
    let buffered = Buffer.alloc(0),
      inflated = 0;
    async function read(n: number): Promise<Buffer> {
      while (buffered.length < n) {
        const next = await iterator.next();
        if (next.done) return fail("Comune non trovato o archivio provinciale troncato.");
        const chunk = Buffer.from(next.value);
        inflated += chunk.length;
        if (inflated > MAX_INFLATED) return fail("Archivio provinciale espanso oltre 512 MiB.");
        buffered = Buffer.concat([buffered, chunk]);
      }
      const result = buffered.subarray(0, n);
      buffered = buffered.subarray(n);
      return result;
    }
    async function discard(n: number) {
      while (n > 0) {
        const size = Math.min(n, 65536);
        await read(size);
        n -= size;
      }
    }
    try {
      while (true) {
        const local = await read(30);
        if (local.readUInt32LE(0) !== 0x04034b50 || local.readUInt16LE(6) & 9)
          return fail("Archivio provinciale con struttura ZIP non supportata.");
        const name = (await read(local.readUInt16LE(26))).toString("utf8");
        await discard(local.readUInt16LE(28));
        const compressedSize = local.readUInt32LE(18),
          size = local.readUInt32LE(22),
          method = local.readUInt16LE(8);
        if (name.startsWith(`${code}_`) && name.endsWith(".zip")) {
          if (size > MAX_ZIP || compressedSize > MAX_ZIP)
            return fail("Archivio comunale oltre il limite di 64 MiB.");
          const bytes = await read(compressedSize);
          const archive =
            method === 0
              ? bytes
              : method === 8
                ? inflateRawSync(bytes, { maxOutputLength: MAX_ZIP })
                : fail("Compressione comunale non supportata.");
          if (archive.length !== size || crc32(archive) !== local.readUInt32LE(14))
            return fail("Archivio comunale troncato.");
          succeeded = true;
          return {
            bytes: archive,
            requestUrl: url,
            retrievedAt: new Date().toISOString(),
            transferredBytes: transferred,
            seconds: (performance.now() - started) / 1000,
            name,
          };
        }
        await discard(compressedSize);
      }
    } finally {
      controller.abort();
      compressed.destroy();
      inflater.destroy();
    }
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError(
      "Download catastale non riuscito entro i limiti: riprovare o preparare l'indice comunale.",
    );
  } finally {
    controller.abort();
    release();
    await recordSource("ade-cadastre", performance.now() - started, succeeded);
    sourceLog("ade-cadastre", new URL(url).host, started, succeeded ? "ok" : "error", "miss");
  }
}
