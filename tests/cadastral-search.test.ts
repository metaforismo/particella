import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GeocodeResult } from "#contracts";
import {
  parseCadastralQuery,
  resolveMunicipality,
  municipalitySnapshot,
} from "#server/countries/it/cadastral-query.ts";
import {
  buildCadastralIndex,
  findIndexedParcel,
  storeCadastralIndex,
} from "#server/countries/it/cadastral-index.ts";
import { zipDirectory, zipMember } from "#server/countries/it/cadastral-archive.ts";
import { GET } from "../src/app/api/v1/geocode/route.ts";
import { coversPoint } from "#server/geo/index.ts";
import { parseParcels } from "#server/countries/it/cadastre.ts";
import { BadRequest, NotFound } from "#server/core/errors.ts";
import { fixtureText, fixtureJson } from "./helpers.ts";

const originalFetch = globalThis.fetch,
  savedDirectory = process.env.PARTICELLA_CADASTRAL_INDEX_DIR;
const directory = await mkdtemp(join(tmpdir(), "particella-search-test-"));
process.env.PARTICELLA_CADASTRAL_INDEX_DIR = directory;
const archive = new Uint8Array(
  await readFile(new URL("./fixtures/cadastral-search-window.zip", import.meta.url)),
);
const index = await buildCadastralIndex(archive, "A564", {
  requestUrl: "https://wfs.cartografia.agenziaentrate.gov.it/inspire/wfs/GetDataset.php?dataset=TOSCANA.zip",
  retrievedAt: "2026-10-05T21:37:55.897Z",
});
await storeCadastralIndex(index);
let calls = 0;
let activeCode: string | undefined;
globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  calls++;
  if (activeCode) {
    if (url.hostname === "wfs.cartografia.agenziaentrate.gov.it" && url.pathname.endsWith("owfs01.php"))
      return new Response(fixtureText(`cadastral-${activeCode}-parcels.xml`), {
        headers: { "Content-Type": "application/xml" },
      });
    if (url.hostname === "geoportale.istat.it")
      return new Response(fixtureText(`cadastral-${activeCode}-municipality.json`), {
        headers: { "Content-Type": "application/json" },
      });
    throw new Error(`Offline test blocked unexpected host ${url.host}`);
  }
  if (
    url.hostname === "wfs.cartografia.agenziaentrate.gov.it" &&
    url.pathname.endsWith("owfs01.php") &&
    url.searchParams.has("BBOX")
  )
    return new Response(fixtureText("ade-rural.xml"), { headers: { "Content-Type": "application/xml" } });
  if (url.hostname === "geoportale.istat.it")
    return new Response(fixtureText("municipality-rural.json"), {
      headers: { "Content-Type": "application/json" },
    });
  throw new Error(`Offline test blocked unexpected host ${url.host}`);
};

test("Italian cadastral parser handles order, punctuation, suffixes, section and leading numeric zeros", () => {
  assert.deepEqual(parseCadastralQuery("Firenze, foglio 150B, particella 782"), {
    municipality: "Firenze",
    sheet: "150B",
    parcel: "782",
    section: null,
  });
  for (const q of [
    "F. 12 p. 340 Bergamo",
    "fg 12 mapp 340 comune di Bergamo",
    "Comune di Bergamo, particella 0340; foglio 0012",
  ])
    assert.deepEqual(parseCadastralQuery(q), {
      municipality: "Bergamo",
      sheet: "12",
      parcel: "340",
      section: null,
    });
  assert.deepEqual(parseCadastralQuery("Venezia sezione A fg 15DZ mapp 3233"), {
    municipality: "Venezia",
    sheet: "15DZ",
    parcel: "3233",
    section: "A",
  });
  assert.equal(parseCadastralQuery("Bergamo sezione 01 fg 12 mapp 340")?.section, "01");
  assert.equal(parseCadastralQuery("Via Tortona 31 Milano"), null);
  assert.equal(parseCadastralQuery("Mappano"), null);
  for (const q of [
    "Firenze foglio 12",
    "foglio 12 particella 340",
    "Firenze fg 12 fg 13 mapp 340",
    "Firenze fg 12 mapp 340 sub 2",
    "Firenze fg 12 mapp 340 mapp 341",
  ])
    assert.throws(() => parseCadastralQuery(q), BadRequest);
});

test("live-downloaded ISTAT snapshot resolves names and accents, and lists actual ambiguous municipalities", () => {
  assert.equal(resolveMunicipality("Firenze").cadastralCode, "D612");
  assert.equal(resolveMunicipality("Bergamo").cadastralCode, "A794");
  assert.equal(resolveMunicipality("Aglie").cadastralCode, "A074");
  const names = new Map<string, typeof municipalitySnapshot.municipalities>();
  for (const row of municipalitySnapshot.municipalities)
    names.set(row.name, [...(names.get(row.name) ?? []), row]);
  const ambiguous = [...names].find(([, rows]) => rows.length > 1)!;
  assert.ok(ambiguous);
  assert.throws(
    () => resolveMunicipality(ambiguous[0]),
    (error: unknown) =>
      error instanceof BadRequest && ambiguous[1].every((m) => error.message.includes(`(${m.provinceCode})`)),
  );
  assert.equal(
    resolveMunicipality(`${ambiguous[0]} (${ambiguous[1][0].provinceCode})`).cadastralCode,
    ambiguous[1][0].cadastralCode,
  );
  assert.throws(() => resolveMunicipality("Comune inventato"), NotFound);
});

test("index reads exact official labels/bboxes, distinguishes absent sheets/parcels, and rejects damaged ZIP", async () => {
  const selected = findIndexedParcel(index, "60", "110", null);
  assert.equal(selected.reference, "A564_006000.110");
  assert.equal(selected.map.sheet, "60");
  assert.ok(selected.bbox[0] < selected.bbox[2]);
  assert.throws(() => findIndexedParcel(index, "9999", "110", null), /Foglio 9999/);
  assert.throws(() => findIndexedParcel(index, "60", "999999", null), /Particella 999999/);
  const damaged = archive.slice();
  damaged[0] = 0;
  await assert.rejects(buildCadastralIndex(damaged, "A564", index));
  const entry = zipDirectory(archive).find((e) => e.name.endsWith("_ple.gml"))!;
  assert.ok(new TextDecoder().decode(zipMember(archive, entry)).includes("A564_006000.110"));
  const truncated = archive.slice(0, -25);
  assert.throws(() => zipDirectory(truncated));
  await assert.rejects(buildCadastralIndex(archive, "D612", index), /mancante/);
});

test("cadastral intent routes before textual geocoders and returns a verified interior point with provenance", async () => {
  const response = await GET(
    new Request("http://localhost/api/v1/geocode?q=Bagno%20a%20Ripoli%20fg%2060%20mapp%20110"),
  );
  assert.equal(response.status, 200);
  const results = await response.json();
  const result = GeocodeResult.parse(results[0]);
  assert.equal(result.kind, "parcel");
  assert.equal(result.id, "it:A564:_:60:110");
  const parcel = parseParcels(fixtureText("ade-rural.xml")).find((p) => p.parcel === "110")!;
  assert.ok(coversPoint(parcel.geometry, result.center));
  assert.ok(result.provenance?.some((p) => p.sourceId === "istat-municipalities"));
  const before = calls;
  const missing = await GET(
    new Request("http://localhost/api/v1/geocode?q=Bagno%20a%20Ripoli%20fg%209999%20mapp%20110"),
  );
  assert.equal(missing.status, 404);
  assert.equal(calls, before);
  const malformed = await GET(new Request("http://localhost/api/v1/geocode?q=Firenze%20foglio%2012"));
  assert.equal(malformed.status, 400);
  assert.equal(calls, before);
});

test("six real municipal search results replay offline from unchanged official labels, bboxes and responses", async () => {
  const fixture = fixtureJson("cadastral-search-index-samples.json") as {
    samples: { query: string; expectedId: string; index: typeof index }[];
  };
  for (const sample of fixture.samples) {
    await storeCadastralIndex(sample.index);
    activeCode = sample.index.belfiore.toLowerCase();
    try {
      const response = await GET(
        new Request(`http://localhost/api/v1/geocode?q=${encodeURIComponent(sample.query)}`),
      );
      assert.equal(response.status, 200);
      const result = GeocodeResult.parse((await response.json())[0]);
      assert.equal(result.id, sample.expectedId);
      assert.equal(result.kind, "parcel");
      if (activeCode === "a122") assert.match(result.secondary!, /Comune amministrativo: Villanova/);
      const parcel = parseParcels(fixtureText(`cadastral-${activeCode}-parcels.xml`)).find((p) =>
        p.reference.endsWith(`.${result.id.split(":").at(-1)}`),
      )!;
      assert.ok(coversPoint(parcel.geometry, result.center));
    } finally {
      activeCode = undefined;
    }
  }
});

test.after(async () => {
  globalThis.fetch = originalFetch;
  if (savedDirectory === undefined) delete process.env.PARTICELLA_CADASTRAL_INDEX_DIR;
  else process.env.PARTICELLA_CADASTRAL_INDEX_DIR = savedDirectory;
  await rm(directory, { recursive: true, force: true });
});
