import { test } from "node:test";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { z } from "zod";
import {
  Health,
  Plot,
  PlotReport,
  GeocodeResult,
  LayerCatalogEntry,
  SourceCatalogEntry,
  ApiError,
} from "../src/lib/contracts/index.ts";
import { GET as health } from "../src/app/api/v1/health/route.ts";
import { GET as geocode } from "../src/app/api/v1/geocode/route.ts";
import { GET as at } from "../src/app/api/v1/plots/at/route.ts";
import { GET as byId } from "../src/app/api/v1/plots/[id]/route.ts";
import { GET as layer } from "../src/app/api/v1/plots/[id]/layers/[layer]/route.ts";
import { GET as report } from "../src/app/api/v1/plots/[id]/report/route.ts";
import { GET as layers } from "../src/app/api/v1/catalog/layers/route.ts";
import { GET as sources } from "../src/app/api/v1/catalog/sources/route.ts";
import { GET as tiles } from "../src/app/api/v1/tiles/[overlay]/[z]/[x]/[y]/route.ts";
import { query, coordinateQuery, route, jsonResponse } from "../src/server/http/responses.ts";
import { canonicalKey, cache } from "../src/server/core/cache.ts";
import { getCountry } from "../src/server/countries/index.ts";
import { layerResult } from "../src/server/core/layers.ts";
import {
  PngTile,
  TileParams,
  cadastralTileRequest,
  reprojectCadastralTile,
} from "../src/server/countries/it/tiles.ts";
import { fixtureText } from "./helpers.ts";

const request = (path: string) => new Request(`http://localhost/api/v1/${path}`);
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  let fixture: string;
  if (url.hostname === "geoportale.istat.it") fixture = "municipality-rural.json";
  else if (url.hostname === "nominatim.openstreetmap.org") fixture = "nominatim.json";
  else if (url.hostname === "wfs.cartografia.agenziaentrate.gov.it")
    fixture =
      url.searchParams.get("TYPENAMES") === "CP:CadastralZoning" ? "ade-zoning-rural.xml" : "ade-rural.xml";
  else throw new Error(`Offline test blocked unexpected host ${url.host}`);
  return new Response(fixtureText(fixture), {
    headers: { "Content-Type": fixture.endsWith("xml") ? "application/xml" : "application/json" },
  });
};

test("route health/catalogs/geocode validate the shared contract", async () => {
  const h = await health();
  assert.equal(h.status, 200);
  Health.parse(await h.json());
  z.array(LayerCatalogEntry).parse(await (await layers()).json());
  z.array(SourceCatalogEntry).parse(await (await sources()).json());
  const result = await geocode(request("geocode?q=Piazza%20Duomo%20Milano"));
  assert.equal(result.status, 200);
  z.array(GeocodeResult).parse(await result.json());
});
test("strict query validation rejects missing, blank, duplicated, non-numeric and out-of-range coordinates", async () => {
  for (const suffix of [
    "",
    "lat=&lon=11",
    "lat=NaN&lon=11",
    "lat=91&lon=11",
    "lat=43&lat=44&lon=11",
    "lat=43&lon=11&url=https://evil.test",
  ]) {
    const response = await at(request(`plots/at?${suffix}`));
    assert.equal(response.status, 400);
    assert.equal(ApiError.parse(await response.json()).error.code, "bad_request");
  }
  assert.deepEqual(query(request("plots/at?lat=43.7&lon=11.32"), coordinateQuery()), {
    lat: 43.7,
    lon: 11.32,
    country: "it",
  });
  const invalid = await byId(request("plots/bad"), { params: Promise.resolve({ id: "bad" }) });
  assert.equal(invalid.status, 400);
});
test("real fixture plotAt and cold reversible plotById agree", async () => {
  const response = await at(request("plots/at?lat=43.7&lon=11.32"));
  assert.equal(response.status, 200);
  const plot = Plot.parse(await response.json());
  assert.equal(plot.id, "it:A564:_:60:110");
  assert.ok(plot.areaM2! > 0);
  assert.equal(plot.municipality?.istatCode, "048001");
  await cache.set(canonicalKey("plot:v1", plot.id), null, 0);
  const cold = await byId(request(`plots/${plot.id}`), { params: Promise.resolve({ id: plot.id }) });
  assert.equal(cold.status, 200);
  assert.equal(Plot.parse(await cold.json()).id, plot.id);
});
test("unknown layers fail validation; report isolates provider failures", async () => {
  const id = "it:A564:_:60:110";
  const invalid = await layer(request(`plots/${id}/layers/bad`), {
    params: Promise.resolve({ id, layer: "bad" }),
  });
  assert.equal(invalid.status, 400);
  const country = getCountry("it"),
    saved = country.layers;
  country.layers = {
    flood: async () => layerResult("flood", { status: "empty", headline: "Nessun oggetto restituito." }),
    solar: async () => {
      throw new Error("offline simulated upstream failure");
    },
  };
  try {
    const response = await report(request(`plots/${id}/report`), { params: Promise.resolve({ id }) });
    assert.equal(response.status, 200);
    const parsed = PlotReport.parse(await response.json());
    assert.equal(parsed.layers.length, 8);
    assert.equal(parsed.layers.find((l) => l.layer === "solar")?.status, "unavailable");
    assert.equal(parsed.layers.find((l) => l.layer === "flood")?.status, "empty");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  } finally {
    country.layers = saved;
  }
});
test("production invalid response returns 500 internal, never invalid JSON or bad_request", async () => {
  const previous = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: "production" });
  try {
    const response = await route(() => jsonResponse(Health, { status: "wrong" }));
    assert.equal(response.status, 500);
    assert.equal(ApiError.parse(await response.json()).error.code, "internal");
  } finally {
    if (previous === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: previous });
  }
});
test("tile proxy rejects arbitrary overlays and out-of-grid coordinates", async () => {
  const bad = await tiles(request("tiles/evil/1/0/0"), {
    params: Promise.resolve({ overlay: "https://evil.test", z: "1", x: "0", y: "0" }),
  });
  assert.equal(bad.status, 400);
  assert.equal(TileParams.safeParse({ overlay: "flood", z: "1", x: "2", y: "0" }).success, false);
  const response = await tiles(request("tiles/cadastre/0/0/0"), {
    params: Promise.resolve({ overlay: "cadastre", z: "0", x: "0", y: "0" }),
  });
  assert.equal(response.status, 200);
  PngTile.parse(new Uint8Array(await response.arrayBuffer()));
});
test("AdE WMS uses latitude/longitude axes and PNG is resampled to Mercator", () => {
  const url = new URL(cadastralTileRequest(16, 34828, 23941));
  assert.equal(url.searchParams.get("CRS"), "EPSG:6706");
  assert.equal(url.searchParams.get("LAYERS"), "CP.CadastralParcel");
  const [s, w, n, e] = url.searchParams.get("BBOX")!.split(",").map(Number);
  assert.ok(s > 40 && s < 50 && w > 5 && w < 15 && n > s && e > w);
  const png = new PNG({ width: 256, height: 256 });
  png.data.fill(255);
  const bytes = reprojectCadastralTile(PNG.sync.write(png), 16, 34828, 23941);
  PngTile.parse(bytes);
  assert.equal(PNG.sync.read(Buffer.from(bytes)).data[0], 255);
});
test.after(() => {
  globalThis.fetch = originalFetch;
});
