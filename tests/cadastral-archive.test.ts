import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { zipSync } from "fflate";
import { downloadMunicipalArchive, zipDirectory } from "#server/countries/it/cadastral-archive.ts";

const fixture = new Uint8Array(
  await readFile(new URL("./fixtures/cadastral-search-window.zip", import.meta.url)),
);
// Synthetic ZIP packaging, unmodified real WFS bytes: exercises bounded nested archive transport.
const province = zipSync({
  "A000_skip.zip": fixture,
  "A564_BAGNO A RIPOLI.zip": fixture,
  "Z999_after.zip": fixture,
});
const region = zipSync({ "FI.zip": province });
const fetcher = globalThis.fetch;
let calls = 0;
globalThis.fetch = async (_input, options) => {
  calls++;
  const range = (options?.headers as Record<string, string>).Range;
  let start = 0,
    end = region.length - 1;
  if (range.startsWith("bytes=-")) start = Math.max(0, region.length - Number(range.slice(7)));
  else {
    const parts = range.slice(6).split("-").map(Number);
    start = parts[0];
    end = Math.min(parts[1], end);
  }
  const response = new Response(region.slice(start, end + 1), {
    status: 206,
    headers: { "Content-Range": `bytes ${start}-${end}/${region.length}` },
  });
  Object.defineProperty(response, "url", {
    value: "https://wfs-download.cartografia.agenziaentrate.eu/wfsdownload/TOSCANA.zip",
  });
  return response;
};

test("official regional ZIP transport extracts the selected Comune after skipping earlier entries", async () => {
  const result = await downloadMunicipalArchive("Toscana", "FI", "A564");
  assert.deepEqual(result.bytes, Buffer.from(fixture));
  assert.equal(result.name, "A564_BAGNO A RIPOLI.zip");
  assert.equal(calls, 3);
  assert.equal(zipDirectory(result.bytes).length, 2);
});

test("an ordinary 200, OGC exception or missing province cannot masquerade as a complete ZIP", async () => {
  await assert.rejects(downloadMunicipalArchive("Toscana", "SI", "A564"), /Provincia non presente/);
  globalThis.fetch = async () => new Response("OGC exception", { status: 200 });
  await assert.rejects(downloadMunicipalArchive("Toscana", "FI", "A564"), /non conferma/);
});

test.after(() => {
  globalThis.fetch = fetcher;
});
