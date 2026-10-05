import { writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { parseDpcCsv, parsePopulationCsv } from "./parsers.ts";
import { http, textBody } from "../../src/server/core/http.ts";
import { source } from "../../src/server/core/sources.ts";

const version = process.env.DPC_VERSION ?? "2025-05";
if (!/^\d{4}-\d{2}$/.test(version)) throw new Error("DPC_VERSION must be YYYY-MM");
const sourceUrl = process.env.DPC_CSV_URL ?? source("dpc-seismic").endpoint;
const input = process.env.DPC_CSV_FILE;
const payload = input ? { bytes: new Uint8Array(await readFile(input)), requestUrl: sourceUrl, retrievedAt: process.env.SNAPSHOT_RETRIEVED_AT ?? new Date().toISOString() } : await http.request(sourceUrl, { ttlMs: 0 });
const sha256 = createHash("sha256").update(payload.bytes).digest("hex");
const dpc = { version, sourceUrl, retrievedAt: payload.retrievedAt, sha256, zones: parseDpcCsv(textBody({ ...payload, contentType: "text/csv" })) };
await writeFile(new URL(`../../data/snapshots/it-dpc-seismic-${version}.json`, import.meta.url), `${JSON.stringify(dpc)}\n`, { flag: "wx" });
console.log(`Written DPC ${version}: ${Object.keys(dpc.zones).length} municipalities. Existing versions are never overwritten.`);

if (process.env.POPULATION_REFRESH === "1") {
  const rows: Record<string, { population: number; sourceUrl: string }> = {}, artifacts = [];
  for (const province of ["015_Milano", "048_Firenze"]) {
    const url = `https://demo.istat.it/data/posas/POSAS_2026_it_${province}.zip`;
    const archive = await http.request(url, { ttlMs: 0 });
    const file = Object.entries(unzipSync(archive.bytes)).find(([name]) => name.endsWith(".csv"));
    if (!file) throw new Error("Population CSV missing from ZIP");
    for (const [code, total] of Object.entries(parsePopulationCsv(new TextDecoder().decode(file[1])))) rows[code] = { population: total, sourceUrl: url };
    artifacts.push({ sourceUrl: url, sha256: createHash("sha256").update(archive.bytes).digest("hex"), retrievedAt: archive.retrievedAt });
  }
  const output = process.env.POPULATION_SNAPSHOT_NAME ?? "it-population-2026-01.json";
  if (!/^it-population-[\d-]+\.json$/.test(output)) throw new Error("Invalid snapshot filename");
  await writeFile(new URL(`../../data/snapshots/${output}`, import.meta.url), `${JSON.stringify({ referenceDate: "2026-01-01", retrievedAt: new Date().toISOString(), artifacts, rows })}\n`, { flag: "wx" });
}
