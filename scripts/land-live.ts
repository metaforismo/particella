import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { PlotReport, LayerResult, type LayerId } from "#contracts";
import { GET as report } from "../src/app/api/v1/plots/[id]/report/route.ts";
import { GET as at } from "../src/app/api/v1/plots/at/route.ts";
import { getCountry } from "#server/countries/index.ts";

export const expansionLayers: LayerId[] = [
  "power-grid",
  "infrastructure-distances",
  "industrial-sites",
  "regional-land-cover",
];

const lots = [
  { name: "Milano urbano", id: "it:F205:_:390:61", at: "45.464800,9.191000" },
  { name: "Bagno a Ripoli agricolo", id: "it:A564:_:60:110", at: "43.700000,11.320000" },
  { name: "Vallombrosa montano", id: "it:H222:_:28:60", at: "43.733000,11.556000" },
];

async function worker(id: string, point: string, name: string) {
  const calls: { host: string; startMs: number; durationMs: number; status?: number; error?: string }[] = [];
  const original = globalThis.fetch;
  const begin = performance.now();
  globalThis.fetch = async (...args) => {
    const start = performance.now();
    const call: (typeof calls)[number] = {
      host: new URL(String(args[0])).host,
      startMs: Math.round(start - begin),
      durationMs: 0,
    };
    calls.push(call);
    try {
      const value = await original(...args);
      call.status = value.status;
      return value;
    } catch (e) {
      call.error = e instanceof Error ? e.message : "Fetch failed";
      throw e;
    } finally {
      call.durationMs = Math.round(performance.now() - start);
    }
  };
  const runs = [];
  for (const temperature of ["cold", "warm"] as const) {
    const start = performance.now();
    const response = await report(new Request(`http://localhost/api/v1/plots/${id}/report?at=${point}`), {
      params: Promise.resolve({ id }),
    });
    const body: unknown = await response.json();
    const durationMs = Math.round(performance.now() - start);
    if (response.status !== 200) throw Error(JSON.stringify(body));
    const result = PlotReport.parse(body);
    if (result.layers.length !== 17 || result.plot.id !== id)
      throw Error("Incomplete report / mismatched plot");
    runs.push({
      temperature,
      durationMs,
      statuses: result.layers.map((l) => ({ layer: l.layer, status: l.status })),
      layers: result.layers,
    });
  }
  return {
    name,
    id,
    at: point,
    environment: process.env.NODE_ENV ?? "unset (manual source verification)",
    timingScope:
      "Route handler including cold plot resolution; excludes Next.js startup, HTTP transport and client rendering",
    runs,
    calls,
  };
}

function child(lot: (typeof lots)[number]): Promise<Awaited<ReturnType<typeof worker>>> {
  return new Promise((resolve, reject) => {
    const process = spawn(
      globalThis.process.execPath,
      ["--experimental-strip-types", new URL(import.meta.url).pathname, "--worker", lot.id, lot.at, lot.name],
      { cwd: globalThis.process.cwd(), stdio: ["ignore", "pipe", "inherit"] },
    );
    let output = "";
    process.stdout.on("data", (data) => {
      output += data;
    });
    process.once("error", reject);
    process.once("exit", (code) => {
      if (code !== 0) reject(new Error(`Report worker ${lot.name} exited ${code}`));
      else {
        try {
          resolve(JSON.parse(output));
        } catch {
          reject(new Error(`Invalid benchmark output ${lot.name}`));
        }
      }
    });
  });
}

export async function runLandLive() {
  const results = [];
  let failures = 0;
  // Each report runs in a fresh process; no source or layer cache from previous checks.
  for (const lot of lots) {
    try {
      const row = await child(lot);
      for (const run of row.runs) console.log(`LAND ${lot.name} ${run.temperature}: ${run.durationMs} ms`);
      for (const layer of row.runs[0].layers.filter(
        (l) => expansionLayers.includes(l.layer) || l.layer === "terrain",
      )) {
        LayerResult.parse(layer);
        const fail =
          ["unavailable", "error", "outside_coverage"].includes(layer.status) || !layer.provenance.length;
        if (fail) failures++;
        console.log(
          `${fail ? "FAIL" : layer.status === "partial" ? "PARTIAL" : "PASS"} LAND ${lot.name} ${layer.layer}: ${layer.status}; ${layer.headline}`,
        );
      }
      results.push({ state: "PASS", ...row });
    } catch (error) {
      failures++;
      results.push({
        state: "FAIL",
        ...lot,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      console.log(`FAIL LAND ${lot.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  // Exact regression coordinates supplied by the user, exercised through the route.
  const response = await at(new Request("http://localhost/api/v1/plots/at?lat=43.7865&lon=11.2010"));
  const debugBody: unknown = await response.json();
  const debug = { status: response.status, body: debugBody };
  if (response.status !== 200 || (debugBody as { id?: string }).id !== "it:D612:_:50:1102") failures++;
  console.log(`${response.status === 200 ? "PASS" : "FAIL"} LAND AdE regression: ${response.status}`);

  const pointChecks = [];
  for (const [name, lat, lon] of [
    ["Firenze urbano", 43.76927, 11.2565],
    ["Lodi agricolo", 45.307, 9.329],
    ["Valsassina montano", 45.929, 9.445],
  ] as const) {
    // Source identify verification, not cadastral proof for these supplemental points.
    try {
      const country = getCountry("it");
      const { municipalityAt } = await import("#server/countries/it/municipality.ts");
      const p = { lat, lon };
      const municipality = await municipalityAt(p);
      const result = await country.layers["regional-land-cover"]!(
        { centroid: p, geometry: null, municipality: municipality.municipality } as Parameters<
          NonNullable<(typeof country.layers)["regional-land-cover"]>
        >[0],
        { signal: AbortSignal.timeout(25000) },
      );
      LayerResult.parse(result);
      if (["unavailable", "error", "outside_coverage"].includes(result.status)) failures++;
      pointChecks.push({ name, point: p, result });
      console.log(`LAND point ${name} regional-land-cover: ${result.status}`);
    } catch (e) {
      failures++;
      pointChecks.push({ name, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }
  await writeFile(
    new URL("../tests/land-live-results.json", import.meta.url),
    JSON.stringify({ executedAt: new Date().toISOString(), failures, results, debug, pointChecks }, null, 2) +
      "\n",
  );
  return failures;
}

if (process.argv[2] === "--worker") {
  try {
    console.log(JSON.stringify(await worker(process.argv[3], process.argv[4], process.argv[5])));
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
} else if (process.argv[1] === new URL(import.meta.url).pathname) {
  process.exitCode = (await runLandLive()) ? 1 : 0;
}
