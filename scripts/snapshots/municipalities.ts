import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { http } from "#server/core/http.ts";

const sourceUrl = "https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.csv";
const payload = await http.request(sourceUrl, { ttlMs: 0 });
const rows = parse(new TextDecoder("windows-1252").decode(payload.bytes), {
  delimiter: ";",
  columns: (columns: string[]) => columns.map((column) => column.replace(/\s+/g, " ").trim()),
  skip_empty_lines: true,
}) as Record<string, string>[];
const municipalities = rows.map((r) => ({
  istatCode: r["Codice Comune formato alfanumerico"],
  name: r["Denominazione in italiano"],
  aliases: r["Denominazione (Italiana e straniera)"].split("/"),
  cadastralCode: r["Codice Catastale del comune"],
  provinceCode: r["Sigla automobilistica"],
  province: r["Denominazione dell'Unità territoriale sovracomunale (valida a fini statistici)"],
  region: r["Denominazione Regione"],
}));
if (
  municipalities.length < 7800 ||
  municipalities.some((m) => !/^\d{6}$/.test(m.istatCode) || !m.name || !m.region)
)
  throw new Error("Invalid ISTAT municipality snapshot");
await writeFile(
  "data/snapshots/it-municipalities.json",
  JSON.stringify({
    sourceUrl,
    retrievedAt: payload.retrievedAt,
    sha256: createHash("sha256").update(payload.bytes).digest("hex"),
    municipalities,
  }) + "\n",
);
console.log(`Written ${municipalities.length} real ISTAT municipalities; the CSV may lag SITUAS.`);
