import { test } from "node:test";
import assert from "node:assert/strict";
import { formatArea, formatLength, formatMetric } from "../src/lib/format.ts";
import { formatAt, parseAt } from "../src/lib/routes.ts";
import { plotGeoJson, plotKml } from "../src/lib/export.ts";
import { resultLabel, stateLabel, summarize } from "../src/components/studio/status.ts";
import type { LayerResult, Plot } from "../src/lib/contracts/index.ts";

const plot: Plot = {
  id: "it:A564:_:60:110",
  country: "it",
  cadastral: {
    municipalityCode: "A564",
    section: null,
    sheet: "60",
    parcel: "110",
    label: "Foglio 60 · Particella 110",
  },
  municipality: {
    istatCode: "048001",
    cadastralCode: "A564",
    name: "Bagno a Ripoli",
    province: "Firenze",
    provinceCode: "FI",
    region: "Toscana",
  },
  address: null,
  centroid: { lat: 43.700437, lon: 11.319406 },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [11.3188, 43.6995],
        [11.3204, 43.7],
        [11.3198, 43.7013],
        [11.3188, 43.6995],
      ],
    ],
  },
  areaM2: 18700,
  perimeterM: 626,
  provenance: [
    {
      sourceId: "ade-cadastre",
      dataset: "Particelle catastali",
      authority: "Agenzia delle Entrate",
      license: "CC BY 4.0",
      url: "https://www.agenziaentrate.gov.it/",
      method: "wfs",
      isOfficial: true,
      retrievedAt: "2026-10-06T00:00:00.000Z",
    },
  ],
};

function layer(overrides: Partial<LayerResult>): LayerResult {
  return {
    layer: "flood",
    group: "rischi",
    title: "Pericolosità idraulica",
    status: "ok",
    scope: "point",
    headline: "",
    severity: "none",
    metrics: [],
    features: null,
    overlays: [],
    legend: [],
    notes: [],
    provenance: [],
    computedAt: "2026-10-06T00:00:00.000Z",
    ...overrides,
  };
}

test("areas switch to hectares at one hectare, Italian separators", () => {
  assert.equal(formatArea(null), "—");
  assert.equal(formatArea(9_999), "9.999 m²");
  assert.equal(formatArea(18_700), "1,87 ha");
  assert.equal(formatLength(626.4), "626 m");
  assert.equal(formatLength(1_250), "1,25 km");
  assert.equal(formatMetric(null, "m"), "—");
  assert.equal(formatMetric(1374.4, "kWh"), "1.374 kWh");
  assert.equal(formatMetric("P3"), "P3");
});

test("the inner-point reference round-trips and rejects junk", () => {
  const at = formatAt({ lat: 43.7004371, lon: 11.3194059 });
  assert.equal(at, "43.700437,11.319406");
  assert.deepEqual(parseAt(at), { lat: 43.700437, lon: 11.319406 });
  for (const bad of [undefined, "", "43.7", "a,b", "91,10", "43.7,181", "43.7;11.3", "43.7,11.3,0"]) {
    assert.equal(parseAt(bad), undefined, String(bad));
  }
});

test("GeoJSON export keeps geometry and cadastral attributes", () => {
  const file = plotGeoJson(plot);
  assert.equal(file.name, "particella-A564-F60-P110.geojson");
  const parsed = JSON.parse(file.body);
  assert.equal(parsed.type, "FeatureCollection");
  assert.deepEqual(parsed.features[0].geometry, plot.geometry);
  assert.equal(parsed.features[0].properties.foglio, "60");
  assert.match(parsed.features[0].properties.fonte, /Agenzia delle Entrate/);
});

test("KML export escapes text and writes lon,lat order", () => {
  const tricky = { ...plot, municipality: { ...plot.municipality!, name: 'Comune <"&">' } };
  const file = plotKml(tricky);
  assert.equal(file.name, "particella-A564-F60-P110.kml");
  assert.ok(!file.body.includes('<"&">'));
  assert.match(file.body, /Comune &lt;&quot;&amp;&quot;&gt;/);
  assert.match(file.body, /<coordinates>11\.3188,43\.6995,0 /);
});

test("status labels never turn missing data into reassurance", () => {
  assert.equal(resultLabel(layer({ status: "empty" })).label, "Nessun elemento");
  assert.equal(resultLabel(layer({ status: "outside_coverage" })).tone, "unknown");
  assert.equal(resultLabel(layer({ status: "unavailable", severity: "none" })).tone, "unknown");
  assert.equal(resultLabel(layer({ severity: "high" })).label, "Rilevante");
  assert.equal(resultLabel(layer({ severity: "unknown" })).label, "Dato incompleto");
  assert.equal(stateLabel(undefined).tone, "pending");
  assert.equal(stateLabel({ status: "failed", message: "x" }).tone, "unknown");
});

test("summary counts every state exactly once", () => {
  const counts = summarize([
    undefined,
    { status: "loading" },
    { status: "failed", message: "x" },
    { status: "done", result: layer({ severity: "high" }) },
    { status: "done", result: layer({ severity: "medium" }) },
    { status: "done", result: layer({ severity: "low" }) },
    { status: "done", result: layer({ status: "empty" }) },
    { status: "done", result: layer({ status: "outside_coverage" }) },
  ]);
  assert.deepEqual(counts, { attention: 2, notable: 1, clear: 1, missing: 2, pending: 2 });
});

test("repeated readings of the same source are listed once, latest first", async () => {
  const { uniqueSources } = await import("../src/lib/provenance.ts");
  const base = plot.provenance[0];
  const list = uniqueSources([
    { ...base, retrievedAt: "2026-10-06T00:00:00.000Z" },
    { ...base, retrievedAt: "2026-10-06T00:00:05.000Z" },
    { ...base, dataset: "Altro dataset" },
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].retrievedAt, "2026-10-06T00:00:05.000Z");
});

test("place line never repeats the comune and only shows a real sigla", async () => {
  const { formatPlace } = await import("../src/lib/format.ts");
  assert.equal(formatPlace(plot.municipality), "Bagno a Ripoli (FI), Toscana");
  assert.equal(formatPlace({ name: "Firenze", provinceCode: "048", region: "Toscana" }), "Firenze, Toscana");
  assert.equal(formatPlace(null), "Comune non identificato");
});
