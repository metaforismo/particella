import { test, after } from "node:test";
import assert from "node:assert/strict";
import type { Plot } from "#contracts";
import { LayerResult } from "#contracts";
import { ProtocolError, UpstreamError, OutsideCoverage, NotConfigured } from "#server/core/errors.ts";
import { HttpClient } from "#server/core/http.ts";
import { MemoryCache } from "#server/core/cache.ts";
import {
  powerGrid,
  infrastructureDistances,
  industrialSites,
  parseOsmLand,
  voltageValues,
  distanceFromPlot,
  osmLandQuery,
} from "#server/countries/it/layers/osm-land.ts";
import {
  parseMapServerInfo,
  parseUcs,
  parseDusaf,
  regionalLandCover,
} from "#server/countries/it/layers/regional-land-cover.ts";
import { plotAt } from "#server/countries/it/cadastre.ts";
import { services } from "#server/countries/it/layers/services.ts";
import { estimateAspect } from "#server/geo/terrain.ts";
import { fixtureJson, fixtureText } from "./helpers.ts";

const center = { lat: 43.7, lon: 11.32 };

const plot = {
  id: "test-data-expansion",
  centroid: center,
  geometry: null,
  municipality: { region: "Toscana" },
} as Plot;

const context = () => ({ signal: new AbortController().signal });

const originalFetch = globalThis.fetch;

let osmCalls = 0;

let zoningCalls = 0;

let allZoningFail = false;

globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  let fixture: string;
  if (url.host === "overpass-api.de") {
    fixture = "osm-land-rural.json";
    osmCalls++;
  } else if (url.host === "www502.regione.toscana.it") fixture = "ucs-bagno.txt";
  else if (url.host === "www.cartografia.servizirl.it") fixture = "dusaf-lodi.json";
  else if (url.host === "geoportale.istat.it") fixture = "municipality-firenze.json";
  else if (url.host === "wfs.cartografia.agenziaentrate.gov.it") {
    if (url.searchParams.get("TYPENAMES") === "CP:CadastralParcel") fixture = "ade-debug-parcel.xml";
    else {
      zoningCalls++;
      const bbox = url.searchParams.get("BBOX")!.split(",").map(Number);
      fixture =
        allZoningFail || bbox[2] - bbox[0] > 0.0001 ? "ade-debug-exception.xml" : "ade-debug-zoning.xml";
    }
  } else throw new Error(`Offline test blocked ${url.host}`);
  return new Response(fixtureText(fixture), {
    headers: {
      "Content-Type": fixture.endsWith("json")
        ? "application/json"
        : fixture.endsWith("xml")
          ? "application/xml"
          : "text/plain",
    },
  });
};

after(() => {
  globalThis.fetch = originalFetch;
});

test("real OSM fixtures from two regions and urban/agricultural/mountain points retain complete geometries", () => {
  for (const [file, centroid] of [
    ["osm-land-milano.json", { lat: 45.4648, lon: 9.191 }],
    ["osm-land-rural.json", center],
    ["osm-land-mountain.json", { lat: 43.733, lon: 11.556 }],
  ] as const) {
    const result = parseOsmLand(fixtureJson(file), { centroid, geometry: null });
    assert.ok(result.features.length);
    assert.ok(result.referenceDate);
    for (const f of result.features)
      assert.ok(Number.isFinite(f.properties.distanceM) && f.properties.distanceM >= 0);
  }
});

test("voltage requires explicit volt units; semicolon lists accepted, unknowns not converted", () => {
  assert.deepEqual(voltageValues("150000;132000"), [150000, 132000]);
  for (const text of [undefined, "", "132 kV", "132000;", "0", "-150000", "132000,220000"])
    assert.equal(voltageValues(text), null);
  const base = fixtureJson("osm-land-rural.json") as { elements: { tags: Record<string, string> }[] };
  base.elements = [
    { type: "way", id: 1, tags: { power: "line", voltage: "132 kV" } },
  ] as unknown as typeof base.elements;
  const parsed = parseOsmLand(base, plot);
  assert.equal(parsed.unknownLines, 1);
  assert.equal(parsed.features.length, 0);
});

test("OSM error remarks and missing metadata never become a successful empty result", () => {
  assert.throws(() => parseOsmLand({ elements: [] }, plot), UpstreamError);
  const data = fixtureJson("osm-land-rural.json") as Record<string, unknown>;
  assert.throws(() => parseOsmLand({ ...data, remark: "runtime error: timeout" }, plot), UpstreamError);
  const result = parseOsmLand({ ...data, elements: [] }, plot);
  assert.equal(result.features.length, 0);
  assert.equal(result.missing.size, 0);
});

test("missing OSM geometry is marked incomplete, not located at its bbox center", () => {
  const data = fixtureJson("osm-land-rural.json") as Record<string, unknown>;
  const result = parseOsmLand(
    {
      ...data,
      elements: [
        {
          type: "way",
          id: 1,
          tags: { power: "line", voltage: "150000" },
          geometry: [null, { lat: 43.7, lon: 11.3 }],
        },
      ],
    },
    plot,
  );
  assert.equal(result.features.length, 0);
  assert.ok(result.missing.has("grid-line"));
});

test("distances use the parcel boundary and intersections, including holes", () => {
  const parcel = {
    ...plot,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [11.31, 43.69],
          [11.33, 43.69],
          [11.33, 43.71],
          [11.31, 43.71],
          [11.31, 43.69],
        ],
      ],
    },
  } as Plot;
  const crossing = {
    type: "LineString" as const,
    coordinates: [
      [11.3, 43.7],
      [11.34, 43.7],
    ],
  };
  assert.equal(distanceFromPlot(parcel, crossing), 0);
  assert.equal(distanceFromPlot(parcel, { type: "Point", coordinates: [11.32, 43.7] }), 0);
  const outside = {
    type: "LineString" as const,
    coordinates: [
      [11.34, 43.69],
      [11.34, 43.71],
    ],
  };
  assert.ok(distanceFromPlot(parcel, outside) < distanceFromPlot(plot, outside));
  parcel.geometry!.coordinates.push([
    [11.315, 43.695],
    [11.315, 43.705],
    [11.325, 43.705],
    [11.325, 43.695],
    [11.315, 43.695],
  ]);
  assert.ok(distanceFromPlot(parcel, { type: "Point", coordinates: [11.32, 43.7] }) > 0);
});

test("overlarge lots are rejected before making an unbounded Overpass query", () => {
  assert.match(osmLandQuery(plot), /out geom tags/);
  const large = {
    ...plot,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [11, 43],
          [12, 43],
          [12, 44],
          [11, 44],
          [11, 43],
        ],
      ],
    },
  } as Plot;
  assert.throws(() => osmLandQuery(large), OutsideCoverage);
});

test("all four OSM providers share one actual HTTP request and contract fields", async () => {
  const before = osmCalls;
  const rows = await Promise.all(
    [powerGrid, infrastructureDistances, industrialSites, services].map((provider) =>
      provider(plot, context()),
    ),
  );
  assert.equal(osmCalls - before, 1);
  for (const row of rows) {
    LayerResult.parse(row);
    assert.ok(["ok", "partial", "empty"].includes(row.status));
    assert.equal(row.scope, "buffer");
    assert.equal(row.provenance[0].isOfficial, false);
    assert.ok(row.method?.includes(row.layer === "services" ? "Overpass" : "voltage"));
    for (const f of row.features!.features)
      assert.ok(row.legend.some((l) => l.classKey === f.properties.classKey));
  }
  assert.ok(rows[0].notes.some((s) => s.includes("cabina primaria")));
  assert.ok(rows[1].notes.some((s) => s.includes("fasce di rispetto legali")));
});

test("public Overpass is disabled for production scouting until a dedicated service is configured", async () => {
  const environment = process.env as Record<string, string | undefined>;
  const before = environment.NODE_ENV;
  try {
    environment.NODE_ENV = "production";
    await assert.rejects(powerGrid(plot, context()), NotConfigured);
  } finally {
    if (before === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = before;
  }
});

test("real UCS and DUSAF point classes retain dates and do not infer sealing", async () => {
  assert.equal(parseUcs(fixtureText("ucs-firenze.txt"))[0].code, "111");
  assert.equal(parseUcs(fixtureText("ucs-bagno.txt"))[0].code, "210");
  assert.deepEqual(parseUcs(fixtureText("ucs-missing.txt")), []);
  for (const file of ["dusaf-milano.json", "dusaf-lodi.json", "dusaf-valsassina.json"]) {
    const data = fixtureJson(file) as { features: { attributes: Record<string, unknown> }[] };
    assert.ok(parseDusaf(data.features.map((f) => f.attributes))[0].label);
  }
  for (const region of ["Toscana", "Lombardia"]) {
    const row = await regionalLandCover({ ...plot, municipality: { region } } as Plot, context());
    LayerResult.parse(row);
    assert.equal(row.scope, "point");
    assert.ok(row.notes.some((n) => n.includes("percentuale impermeabilizzata")));
    assert.equal(row.provenance[0].referenceDate, region === "Toscana" ? "2019" : "2021");
  }
  await assert.rejects(
    regionalLandCover({ ...plot, municipality: { region: "Lazio" } } as Plot, context()),
    OutsideCoverage,
  );
});

test("malformed regional classes and unexpected text fail instead of becoming missing data", () => {
  assert.throws(() => parseMapServerInfo("<html>maintenance</html>", "anything"), UpstreamError);
  assert.throws(() => parseDusaf([{ DESCR: "unknown" }]), UpstreamError);
  assert.throws(
    () =>
      parseUcs(
        "GetFeatureInfo results:\nLayer 'rt_ucs.iducs.10k.2019.rt.full'\n  Feature 0:\n    ucs2019 = ''\n",
      ),
    UpstreamError,
  );
});

test("AdE InvalidFormat on the original bbox retries a smaller bbox and preserves verified parcel identity", async () => {
  const before = zoningCalls;
  const result = await plotAt(43.7865, 11.201);
  assert.equal(result.id, "it:D612:_:50:1102");
  assert.equal(zoningCalls - before, 2);
  assert.ok(result.provenance[1].requestUrl?.includes("43.78648000"));
});

test("AdE bbox retries are bounded and return an understandable source error when both fail", async () => {
  allZoningFail = true;
  const before = zoningCalls;
  try {
    // Distinct bbox avoids using the successful cached zoning response above.
    await assert.rejects(
      plotAt(43.786501, 11.201001),
      (error: unknown) => error instanceof UpstreamError && error.message.includes("servizio catastale"),
    );
    assert.equal(zoningCalls - before, 2);
  } finally {
    allZoningFail = false;
  }
});

test("OGC protocol error kind and message survive negative caching", async () => {
  let calls = 0;
  const client = new HttpClient(new MemoryCache(), { acquire: async () => () => {} }, async () => {
    calls++;
    return new Response(fixtureText("ade-debug-exception.xml"));
  });
  for (let i = 0; i < 2; i++)
    await assert.rejects(
      client.request("https://example.test/ogc"),
      (e: unknown) => e instanceof ProtocolError && e.kind === "ogc_exception",
    );
  assert.equal(calls, 1);
});

test("aspect uses downslope clockwise from north and leaves flat or insufficient samples unknown", () => {
  const samples = [
    { center: { lat: 43, lon: 11 }, elevation: 100 },
    { center: { lat: 43.001, lon: 11 }, elevation: 110 },
    { center: { lat: 43, lon: 11.001 }, elevation: 100 },
  ];
  assert.ok(Math.abs(estimateAspect(samples)! - 180) < 0.01);
  const flat = samples.map((s) => ({ ...s, elevation: 100 }));
  assert.equal(estimateAspect(flat), null);
  assert.equal(estimateAspect(samples.slice(0, 2)), null);
});
