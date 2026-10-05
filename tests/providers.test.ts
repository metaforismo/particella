import { test } from "node:test";
import assert from "node:assert/strict";
import { LayerResult, Plot, MapOverlay, Provenance } from "../src/lib/contracts/index.ts";
import { getCountry } from "../src/server/countries/index.ts";
import { parseParcels } from "../src/server/countries/it/cadastre.ts";
import { fixtureText } from "./helpers.ts";

const originalFetch = globalThis.fetch;
let floodMode: "positive" | "empty" | "partial" = "positive";
globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  let fixture: string;
  if (url.hostname === "idrogeo.isprambiente.it") {
    const layer = url.searchParams.get("layers");
    if (floodMode === "partial" && layer?.endsWith("_p3")) return new Response("missing", { status: 400 });
    fixture =
      layer === "idrogeo:pericolosita_frane"
        ? "landslide-positive.json"
        : layer === "idrogeo:pericolosita_idraulica_p2"
          ? "flood-positive.json"
          : "flood-empty.json";
    if (floodMode === "empty") fixture = "flood-empty.json";
  } else if (url.hostname === "mps04-ws.pi.ingv.it") fixture = "pga-firenze.xml";
  else if (url.hostname === "bio.discomap.eea.europa.eu") fixture = "protected-positive.json";
  else if (url.hostname === "tinitaly.pi.ingv.it") fixture = "terrain.json";
  else if (url.hostname === "re.jrc.ec.europa.eu") fixture = "solar.json";
  else if (url.hostname === "overpass-api.de") fixture = "services.json";
  else if (url.hostname === "geoportale.istat.it") fixture = "grid-rural.json";
  else throw new Error(`Offline test blocked unexpected host ${url.host}`);
  return new Response(fixtureText(fixture), {
    headers: { "Content-Type": fixture.endsWith("xml") ? "application/xml" : "application/json" },
  });
};

function plot(lat: number, lon: number): Plot {
  return Plot.parse({
    id: `test:${lat}:${lon}`,
    country: "it",
    cadastral: { municipalityCode: "A564", section: null, sheet: "60", parcel: "110", label: "Test fixture" },
    municipality: {
      istatCode: "048001",
      cadastralCode: "A564",
      name: "Bagno a Ripoli",
      province: null,
      provinceCode: "048",
      region: "Toscana",
    },
    address: null,
    centroid: { lat, lon },
    geometry: null,
    areaM2: null,
    perimeterM: null,
    provenance: [],
  });
}
const context = () => ({ signal: new AbortController().signal });
test("all eight real providers normalize offline fixtures with source attribution and stable class keys", async () => {
  const country = getCountry("it");
  for (const [id, provider] of Object.entries(country.layers)) {
    const p =
      id === "services"
        ? plot(45.4642, 9.19)
        : id === "protected-areas"
          ? plot(45.635, 9.097)
          : plot(43.7, 11.32);
    if (id === "terrain") p.geometry = parseParcels(fixtureText("ade-rural.xml"))[1].geometry;
    const result = LayerResult.parse(await provider(p, context()));
    assert.equal(result.layer, id);
    assert.ok(["ok", "partial"].includes(result.status), `${id}: ${result.status}`);
    assert.ok(result.provenance.length > 0, id);
    for (const entry of result.provenance) {
      assert.ok(entry.requestUrl?.startsWith("https://"));
      assert.equal(entry.isOfficial, id !== "services");
    }
    const keys = new Set(result.legend.map((entry) => entry.classKey));
    for (const f of result.features?.features ?? []) assert.ok(keys.has(f.properties.classKey), id);
    for (const overlay of result.overlays) assert.ok(overlay.tileUrl.startsWith("/api/v1/tiles/"));
    if (id === "flood") {
      assert.equal(result.severity, "medium");
      assert.equal(result.scope, "point");
    }
    if (id === "landslide") {
      assert.equal(result.severity, "high");
      assert.equal(result.metrics[0].value, "P3");
    }
    if (id === "seismic") {
      assert.equal(result.scope, "municipality");
      assert.equal(result.metrics[0].value, "3");
    }
    if (id === "protected-areas")
      assert.ok(result.features!.features.some((f) => f.properties.relation === "contains"));
    if (id === "terrain") {
      assert.equal(result.scope, "parcel");
      assert.equal(result.metrics[3].value, 0);
    }
    if (id === "demographics") {
      assert.equal(result.scope, "grid_cell");
      assert.equal(result.metrics[0].value, 99);
    }
  }
});
test("web URL contract rejects unsafe schemes and overlays require the local proxy", () => {
  const entry = {
    sourceId: "test",
    dataset: "test",
    authority: "test",
    license: "test",
    url: "https://example.test",
    method: "api",
    isOfficial: true,
    retrievedAt: new Date().toISOString(),
  };
  for (const url of ["javascript:alert(1)", "data:text/html,test", "ftp://example.test/file"]) {
    assert.equal(Provenance.safeParse({ ...entry, url }).success, false);
  }
  const overlay = getCountry("it").overlays.find((entry) => entry.id === "cadastre")!;
  assert.equal(overlay.tileUrl, "/api/v1/tiles/cadastre/{z}/{x}/{y}");
  assert.equal(MapOverlay.safeParse({ ...overlay, tileUrl: "https://example.test/{z}" }).success, false);
});
test("complete empty flood is unknown risk; one failed scenario produces partial data", async () => {
  const country = getCountry("it");
  floodMode = "empty";
  const empty = await country.layers.flood!(plot(40, 10), context());
  assert.equal(empty.status, "empty");
  assert.equal(empty.severity, "unknown");
  floodMode = "partial";
  const partial = await country.layers.flood!(plot(41, 10), context());
  assert.equal(partial.status, "partial");
  assert.equal(partial.provenance.length, 2);
});
test.after(() => {
  globalThis.fetch = originalFetch;
});
