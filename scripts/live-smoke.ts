import { runCadastralLive } from "./session-e-live.ts";
import { writeFile } from "node:fs/promises";
import { runLandLive } from "./land-live.ts";
import { runPlanningLive } from "./session-d-live.ts";
import { z } from "zod";
import {
  Plot,
  LayerResult,
  PlotReport,
  Health,
  LayerCatalogEntry,
  SourceCatalogEntry,
  GeocodeResult,
  ApiError,
} from "#contracts";
import { getCountry } from "#server/countries/index.ts";
import { layerCatalog, runLayer } from "#server/core/layers.ts";
import { municipalityAt } from "#server/countries/it/municipality.ts";
import { cache, canonicalKey } from "#server/core/cache.ts";
import { NotFound } from "#server/core/errors.ts";
import { tile, PngTile, TileParams } from "#server/countries/it/tiles.ts";
import { GET as health } from "../src/app/api/v1/health/route.ts";
import { GET as at } from "../src/app/api/v1/plots/at/route.ts";
import { GET as byId } from "../src/app/api/v1/plots/[id]/route.ts";
import { GET as layerRoute } from "../src/app/api/v1/plots/[id]/layers/[layer]/route.ts";
import { GET as report } from "../src/app/api/v1/plots/[id]/report/route.ts";
import { GET as geocode } from "../src/app/api/v1/geocode/route.ts";
import { GET as layerCatalogRoute } from "../src/app/api/v1/catalog/layers/route.ts";
import { GET as sourceCatalogRoute } from "../src/app/api/v1/catalog/sources/route.ts";
import { POST as chat } from "../src/app/api/v1/studio/chat/route.ts";
import { chatConfigured } from "#server/chat/index.ts";

if (process.argv.includes("--cadastral")) {
  process.exit((await runCadastralLive()) ? 0 : 1);
}

const results: { check: string; state: "PASS" | "FAIL" | "PARTIAL" | "NOT RUN"; detail: unknown }[] = [];

async function check(name: string, action: () => Promise<unknown>) {
  try {
    const detail = await action();
    results.push({ check: name, state: "PASS", detail });
    console.log(`PASS ${name}`, JSON.stringify(detail));
    return detail;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    results.push({ check: name, state: "FAIL", detail });
    console.log(`FAIL ${name}: ${detail}`);
    return undefined;
  }
}

const request = (path: string) => new Request(`http://localhost/api/v1/${path}`);

async function successful(response: Response) {
  const value: unknown = await response.json();
  if (response.status !== 200) throw Error(JSON.stringify(value));
  return value;
}

function recordLayer(name: string, result: LayerResult) {
  const state = ["unavailable", "error"].includes(result.status)
    ? "FAIL"
    : result.status === "partial"
      ? "PARTIAL"
      : "PASS";
  results.push({ check: `${result.layer} ${name}`, state, detail: result });
  console.log(`${state} ${result.layer} ${name}: ${result.status}`);
}

const it = getCountry("it");

await check("health", async () => Health.parse(await successful(await health())));

await check("catalog layers", async () => ({
  count: z.array(LayerCatalogEntry).parse(await successful(await layerCatalogRoute())).length,
}));

await check("catalog sources", async () => ({
  count: z.array(SourceCatalogEntry).parse(await successful(await sourceCatalogRoute())).length,
}));

// This is the first cadastral request in a fresh process: both plot and HTTP caches are cold.
let florence: z.infer<typeof Plot> | undefined;

await check("GET plot Firenze cold ID + at", async () => {
  const id = "it:D612:_:173:68";
  florence = Plot.parse(
    await successful(
      await byId(request(`plots/${id}?at=43.769270,11.256500`), { params: Promise.resolve({ id }) }),
    ),
  );
  if (florence.id !== id || florence.municipality?.provinceCode !== "FI")
    throw Error("Parcel or province mismatch");
  return { id, areaM2: florence.areaM2, municipality: florence.municipality };
});

for (const q of ["Via Tortona 31 Milano", "Bagno a Ripoli", "Piazza della Signoria Firenze"]) {
  await check(`geocode ${q}`, async () => {
    const rows = z
      .array(GeocodeResult)
      .parse(await successful(await geocode(request(`geocode?q=${encodeURIComponent(q)}`))));
    if (!rows.length) throw Error("No results");
    const p = rows[0].center;
    const expected = q.includes("Milano")
      ? { lat: 45.4517, lon: 9.1628 }
      : q.includes("Ripoli")
        ? { lat: 43.7522, lon: 11.32 }
        : { lat: 43.7696, lon: 11.2558 };
    if (Math.abs(p.lat - expected.lat) > 0.02 || Math.abs(p.lon - expected.lon) > 0.02)
      throw Error("Result far from requested place");
    return rows[0];
  });
}

await check("plotAt Milano Duomo is street", async () => {
  try {
    await it.plotAt(45.4642, 9.19);
  } catch (error) {
    if (error instanceof NotFound && error.message.includes("strada"))
      return { expected: "not_found", message: error.message };
    throw error;
  }
  throw Error("Street incorrectly returned as a plot");
});

let rural: z.infer<typeof Plot> | undefined;

await check("GET plotAt rural Toscana", async () => {
  rural = Plot.parse(await successful(await at(request("plots/at?lat=43.7&lon=11.32"))));
  if (rural.id !== "it:A564:_:60:110") throw Error(`Unexpected parcel ${rural.id}`);
  return { id: rural.id, areaM2: rural.areaM2, province: rural.municipality?.provinceCode };
});

if (rural) {
  await cache.set(canonicalKey("plot:v1", rural.id), null, 0);
  const response = await byId(request(`plots/${rural.id}`), { params: Promise.resolve({ id: rural.id }) });
  if (response.status === 200)
    await check("GET plot cold without at", async () => ({ id: Plot.parse(await response.json()).id }));
  else {
    const body = ApiError.parse(await response.json());
    results.push({
      check: "GET plot cold without at",
      state: "PARTIAL",
      detail: {
        status: response.status,
        body,
        limit: "Attribute lookup is not confirmed by the public WFS; use at.",
      },
    });
    console.log(`PARTIAL GET plot cold without at: ${body.error.code}`);
  }
  await check("GET plot cold with at after negative ID lookup", async () => ({
    id: Plot.parse(
      await successful(
        await byId(request(`plots/${rural!.id}?at=43.700000,11.320000`), {
          params: Promise.resolve({ id: rural!.id }),
        }),
      ),
    ).id,
  }));
}

if (florence) {
  const id = florence.id;
  await check("GET mismatched plot + at", async () => {
    const other = "it:D612:_:173:69";
    const response = await byId(request(`plots/${other}?at=43.769270,11.256500`), {
      params: Promise.resolve({ id: other }),
    });
    if (response.status !== 404) throw Error(`Expected 404, got ${response.status}`);
    return ApiError.parse(await response.json());
  });
  await check("GET malformed at", async () => {
    const response = await byId(request(`plots/${id}?at=bad`), { params: Promise.resolve({ id }) });
    if (response.status !== 400) throw Error(`Expected 400, got ${response.status}`);
    return ApiError.parse(await response.json());
  });
  await cache.set(canonicalKey("plot:v1", id), null, 0);
  await check("GET layer planning cold ID + at", async () => {
    const result = LayerResult.parse(
      await successful(
        await layerRoute(request(`plots/${id}/layers/planning?at=43.769270,11.256500`), {
          params: Promise.resolve({ id, layer: "planning" }),
        }),
      ),
    );
    if (result.status !== "ok") throw Error(`Planning status ${result.status}`);
    return { status: result.status, headline: result.headline, provenance: result.provenance };
  });
  await cache.set(canonicalKey("plot:v1", id), null, 0);
  await check("GET report cold ID + at", async () => {
    const value = PlotReport.parse(
      await successful(
        await report(request(`plots/${id}/report?at=43.769270,11.256500`), {
          params: Promise.resolve({ id }),
        }),
      ),
    );
    if (value.layers.length !== 17) throw Error("Incomplete report catalog");
    value.layers.forEach((result) => recordLayer("Firenze", result));
    return {
      id: value.plot.id,
      layers: value.layers.length,
      statuses: value.layers.map(({ layer, status }) => ({ layer, status })),
    };
  });
}

for (const [name, p, belfiore] of [
  ["Milano", { lat: 45.4642, lon: 9.19 }, "F205"],
  ["Toscana", { lat: 43.7, lon: 11.32 }, "A564"],
] as const) {
  const municipality = await check(
    `municipality ${name}`,
    async () => (await municipalityAt(p, belfiore)).municipality,
  );
  const plot =
    name === "Toscana" && rural
      ? rural
      : Plot.parse({
          id: `live:${name}:point`,
          country: "it",
          cadastral: {
            municipalityCode: belfiore,
            section: null,
            sheet: "0",
            parcel: "0",
            label: "Smoke puntuale, non particella catastale",
          },
          municipality: municipality ?? null,
          address: null,
          centroid: p,
          geometry: null,
          areaM2: null,
          perimeterM: null,
          provenance: [],
        });
  await Promise.all(
    layerCatalog.map(async ({ id }) =>
      recordLayer(name, LayerResult.parse(await runLayer(id, plot, it.layers[id], 30_000))),
    ),
  );
}

const zoom = 18;

const point = { lat: 43.7, lon: 11.32 };

const n = 2 ** zoom;

const x = Math.floor(((point.lon + 180) / 360) * n);

const y = Math.floor(((1 - Math.asinh(Math.tan((point.lat * Math.PI) / 180)) / Math.PI) / 2) * n);

for (const overlay of ["cadastre", "flood", "landslide"])
  await check(`tile ${overlay}`, async () => {
    const bytes = await tile(TileParams.parse({ overlay, z: String(zoom), x: String(x), y: String(y) }));
    PngTile.parse(bytes);
    return { z: zoom, x, y, bytes: bytes.length };
  });

if (!(await chatConfigured()))
  await check("POST chat unconfigured", async () => {
    const response = await chat(
      new Request("http://localhost/api/v1/studio/chat", {
        method: "POST",
        body: JSON.stringify({
          id: "live-config-check",
          plotId: "it:D612:_:173:68",
          messages: [
            { id: "question", role: "user", parts: [{ type: "text", text: "Quali dati ci sono?" }] },
          ],
        }),
      }),
    );
    if (response.status !== 503) throw Error(`Expected 503, got ${response.status}`);
    return ApiError.parse(await response.json());
  });
else
  results.push({
    check: "POST chat configured model",
    state: "NOT RUN",
    detail: "No paid model call in live smoke. Offline mock verifies SDK stream and tools.",
  });

await writeFile(
  new URL("../tests/live-results.json", import.meta.url),
  JSON.stringify(
    {
      executedAt: new Date().toISOString(),
      points: {
        firenze: { lat: 43.76927, lon: 11.2565 },
        milano: { lat: 45.4642, lon: 9.19 },
        toscana: { lat: 43.7, lon: 11.32 },
      },
      results,
    },
    null,
    2,
  ) + "\n",
);

const failed = results.filter((r) => r.state === "FAIL").length;

console.log(
  `Live summary: ${results.filter((r) => r.state === "PASS").length} PASS, ${results.filter((r) => r.state === "PARTIAL").length} PARTIAL, ${failed} FAIL.`,
);

const landFailures = await runLandLive();
const planningFailures = await runPlanningLive();
process.exitCode = failed || landFailures || planningFailures ? 1 : 0;

if (!(await runCadastralLive())) process.exitCode = 1;
