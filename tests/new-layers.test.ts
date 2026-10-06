import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { Plot, LayerResult } from "#contracts";
import { getCountry } from "#server/countries/index.ts";
import { parseOmiKml, parseOmiPrices } from "#server/countries/it/layers/market.ts";
import { parseFirenzePlanning } from "#server/countries/it/layers/planning.ts";
import { coversPoint } from "#server/geo/index.ts";
import { removeCadastralFill, reprojectCadastralTile } from "#server/countries/it/tiles.ts";
import { fixtureText } from "./helpers.ts";

const originalFetch = globalThis.fetch;

let overpassRequests = 0;

globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  let name: string;
  if (url.hostname === "sitap.cultura.gov.it")
    name = url.searchParams.get("layers")?.includes("142") ? "landscape-142.json" : "landscape-positive.json";
  else if (url.hostname === "tms.comune.fi.it") name = "planning-firenze.xml";
  else if (url.hostname === "www.cartografia.servizirl.it") name = "planning-pgt-identify-milano.json";
  else if (url.hostname === "image.discomap.eea.europa.eu") name = "corine.json";
  else if (url.hostname === "valhalla1.openstreetmap.de")
    name =
      JSON.parse(url.searchParams.get("json")!).costing === "auto"
        ? "accessibility-car.json"
        : "accessibility-walk.json";
  else if (url.hostname === "overpass-api.de") {
    name = "services.json";
    overpassRequests++;
  } else if (url.hostname === "www1.agenziaentrate.gov.it")
    name = url.pathname.endsWith("perimetri.php")
      ? "omi-firenze.zip"
      : url.pathname.endsWith("stampaomi.php")
        ? "omi-prices.html"
        : url.searchParams.get("richiesta") === "5"
          ? "omi-semesters.json"
          : "omi-zone-list.json";
  else throw Error(`Unexpected offline host ${url.host}`);
  if (url.pathname.endsWith("stampaomi.php")) {
    assert.ok(url.search.startsWith("?D612/FI"));
    assert.equal(url.search.includes("="), false);
  }
  return new Response(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)), {
    headers: {
      "Content-Type": name.endsWith("zip")
        ? "application/zip"
        : name.endsWith("html")
          ? "text/html"
          : name.endsWith("xml")
            ? "application/xml"
            : "application/json",
    },
  });
};

function plot(milano = false) {
  const center = milano ? { lat: 45.4642, lon: 9.19 } : { lat: 43.7696, lon: 11.2558 };
  return Plot.parse({
    id: milano ? "it:F205:_:1:1" : "it:D612:_:173:68",
    country: "it",
    cadastral: {
      municipalityCode: milano ? "F205" : "D612",
      section: null,
      sheet: "173",
      parcel: "68",
      label: "Test",
    },
    municipality: {
      istatCode: milano ? "015146" : "048017",
      cadastralCode: milano ? "F205" : "D612",
      name: milano ? "Milano" : "Firenze",
      province: milano ? "Milano" : "Firenze",
      provinceCode: milano ? "MI" : "FI",
      region: milano ? "Lombardia" : "Toscana",
    },
    centroid: center,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [center.lon - 0.00001, center.lat - 0.00001],
          [center.lon + 0.00001, center.lat - 0.00001],
          [center.lon + 0.00001, center.lat + 0.00001],
          [center.lon - 0.00001, center.lat + 0.00001],
          [center.lon - 0.00001, center.lat - 0.00001],
        ],
      ],
    },
    address: null,
    areaM2: null,
    perimeterM: null,
    provenance: [],
  });
}

const context = () => ({ signal: new AbortController().signal });

test("all five new providers use real offline fixtures, honest scope and source attribution", async () => {
  const country = getCountry("it");
  for (const id of ["landscape", "planning", "land-cover", "accessibility", "market"] as const) {
    const result = LayerResult.parse(await country.layers[id]!(plot(), context()));
    assert.equal(result.status, "ok", `${id}: ${result.headline}`);
    assert.ok(result.method);
    assert.ok(result.provenance.length);
    assert.ok(result.legend.every((entry) => entry.classKey));
    if (id === "landscape" || id === "planning") assert.equal(result.scope, "point");
    if (id === "market") {
      assert.equal(result.scope, "zone");
      assert.equal(result.metrics.find((m) => m.key === "residential-0-min")?.value, 3600);
    }
    if (id === "land-cover") {
      assert.equal(result.metrics.find((m) => m.key === "dominant_cover")?.value, "Tessuto urbano continuo");
      assert.equal(result.metrics.find((m) => m.key === "impervious_share")?.value, null);
    }
    if (id === "accessibility")
      assert.deepEqual(
        result.legend.map((l) => l.classKey),
        ["walk-10", "car-10"],
      );
  }
  const milano = await country.layers.planning!(plot(true), context());
  assert.equal(milano.status, "ok");
  assert.ok(milano.notes.some((n) => n.includes("non conformativa")));
  assert.equal(milano.provenance[0].license, "CC BY 4.0");
  const other = plot();
  other.municipality!.istatCode = "048001";
  other.municipality!.name = "Bagno a Ripoli";
  assert.equal((await country.layers.planning!(other, context())).status, "outside_coverage");
});

test("accessibility and services share Overpass cache instead of making a second request", async () => {
  const country = getCountry("it");
  await country.layers.services!(plot(), context());
  assert.equal(overpassRequests, 1);
});

test("OMI chooses containing KML zone and rejects wrong-zone HTML or malformed tables", () => {
  const zones = parseOmiKml(readFileSync(new URL("./fixtures/omi-firenze.zip", import.meta.url)));
  assert.deepEqual(
    [
      ...new Set(
        zones.filter((z) => coversPoint(z.geometry, { lat: 43.7696, lon: 11.2558 })).map((z) => z.zone),
      ),
    ],
    ["B5"],
  );
  const rows = parseOmiPrices(fixtureText("omi-prices.html"), {
    code: "D612",
    zone: "B5",
    semester: "20252",
  });
  assert.equal(rows[0].min, 3600);
  assert.equal(rows[0].max, 5300);
  assert.equal(rows[0].surface, "L");
  assert.throws(() =>
    parseOmiPrices(fixtureText("omi-prices.html"), { code: "D612", zone: "B6", semester: "20252" }),
  );
  assert.throws(() => parseOmiPrices("<html>temporarily unavailable</html>"));
  assert.throws(() => parseOmiKml(new Uint8Array([0, 1, 2])));
  assert.throws(() => parseFirenzePlanning("<html>not a plan</html>"));
});

test("real cream cadastral PNG becomes transparent while every dark line and red attribution pixel stays intact", () => {
  const bytes = readFileSync(new URL("./fixtures/cadastre-real-z18.png", import.meta.url));
  const original = PNG.sync.read(bytes);
  const output = PNG.sync.read(bytes);
  removeCadastralFill(output);
  let cleared = 0;
  let retained = 0;
  for (let i = 0; i < original.data.length; i += 4) {
    if (original.data[i] === 253 && original.data[i + 1] === 236 && original.data[i + 2] === 189) {
      assert.equal(output.data[i + 3], 0);
      cleared++;
    }
    if (
      original.data[i + 3] &&
      (original.data[i] < 100 || (original.data[i] > 180 && original.data[i + 1] < 180))
    ) {
      assert.deepEqual(output.data.subarray(i, i + 4), original.data.subarray(i, i + 4));
      retained++;
    }
  }
  assert.ok(cleared > 60_000);
  assert.ok(retained > 100);
  const projected = PNG.sync.read(Buffer.from(reprojectCadastralTile(bytes, 18, 139314, 95623)));
  assert.ok(projected.data.some((alpha, i) => i % 4 === 3 && alpha === 0));
});

test.after(() => {
  globalThis.fetch = originalFetch;
});

test("real rural OMI response has residential prices but no predominant typology; never invent one", () => {
  const rows = parseOmiPrices(fixtureText("omi-prices-rural.html"), {
    code: "A564",
    zone: "R1",
    semester: "20252",
  });
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.isPredominant === false));
  assert.equal(rows[0].type, "Abitazioni civili");
  assert.equal(rows[0].min, 1750);
  assert.equal(rows[0].max, 2600);
});
