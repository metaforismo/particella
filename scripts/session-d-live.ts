import { writeFile } from "node:fs/promises";
import { GET as at } from "../src/app/api/v1/plots/at/route.ts";
import { Plot, ApiError, LayerResult } from "#contracts";
import { planning } from "#server/countries/it/layers/planning.ts";
import { decimalDotQuantities } from "#server/core/format.ts";

export async function runPlanningLive() {
  const results = [];
  for (const [name, istat, belfiore, region, lat, lon] of [
    ["Bergamo", "016024", "A794", "Lombardia", 45.6983, 9.6773],
    ["Torino", "001272", "L219", "Piemonte", 45.06, 7.67],
    ["Siena", "052032", "I726", "Toscana", 43.3186, 11.3308],
    ["Sona", "023083", "I826", "Veneto", 45.43554332, 10.8777442],
  ] as const) {
    const plot = Plot.parse({
      id: `live-planning:${istat}`,
      country: "it",
      cadastral: {
        municipalityCode: belfiore,
        section: null,
        sheet: "0",
        parcel: "0",
        label: "Verifica puntuale, non lotto catastale",
      },
      municipality: {
        istatCode: istat,
        cadastralCode: belfiore,
        name,
        region,
        province: null,
        provinceCode: null,
      },
      centroid: { lat, lon },
      geometry: null,
      areaM2: null,
      perimeterM: null,
      address: null,
      provenance: [],
    });
    try {
      const result = LayerResult.parse(await planning(plot, { signal: AbortSignal.timeout(8000) }));
      const badText = [result.headline, ...result.notes].flatMap(decimalDotQuantities);
      const state = result.status === "ok" && !badText.length ? "PASS" : "FAIL";
      results.push({ name, state, result });
      console.log(`${state} planning ${name}: ${result.headline}`);
    } catch (error) {
      results.push({ name, state: "FAIL", error: error instanceof Error ? error.message : "Unknown error" });
      console.log(`FAIL planning ${name}`);
    }
  }
  await writeFile(
    new URL("../docs/backend/verification/session-d/planning-live.json", import.meta.url),
    JSON.stringify({ executedAt: new Date().toISOString(), results }, null, 2) + "\n",
  );
  return results.filter((r) => r.state === "FAIL").length;
}

export async function runRandomPlotsLive() {
  let seed = 20261006;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const locations = [
    ["Torino urbano", "Piemonte", 45.06, 7.67],
    ["Milano urbano", "Lombardia", 45.4648, 9.191],
    ["Bologna urbano", "Emilia-Romagna", 44.4949, 11.3426],
    ["Venezia costa/canali", "Veneto", 45.4341, 12.3388],
    ["Roma urbano", "Lazio", 41.899, 12.475],
    ["Lecce urbano", "Puglia", 40.3529, 18.1719],
    ["Genova costa", "Liguria", 44.407, 8.933],
    ["Cagliari costa", "Sardegna", 39.215, 9.11],
    ["Vallombrosa montagna/campagna", "Toscana", 43.733, 11.556],
    ["Trento fuori copertura AdE", "Trentino-Alto Adige", 46.067, 11.121],
  ] as const;
  const results = [];
  const originalFetch = globalThis.fetch;
  const captureRun = new Date().toISOString().replace(/[^0-9T]/g, "");
  let captureName = "";
  let requestNumber = 0;
  globalThis.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const url = new URL(String(args[0]));
    if (url.host === "wfs.cartografia.agenziaentrate.gov.it") {
      const filename = `random-${captureRun}-${captureName}-${requestNumber++}`;
      const bytes = new Uint8Array(await response.clone().arrayBuffer());
      await writeFile(
        new URL(`../docs/backend/verification/session-d/${filename}.xml`, import.meta.url),
        bytes,
      );
      await writeFile(
        new URL(`../docs/backend/verification/session-d/${filename}.meta.json`, import.meta.url),
        JSON.stringify(
          { url: url.toString(), status: response.status, executedAt: new Date().toISOString() },
          null,
          2,
        ) + "\n",
      );
    }
    return response;
  };
  for (const [name, region, baseLat, baseLon] of locations) {
    captureName = region.toLowerCase().replace(/[^a-z]/g, "");
    const lat = Number((baseLat + (random() - 0.5) * 0.002).toFixed(7));
    const lon = Number((baseLon + (random() - 0.5) * 0.002).toFixed(7));
    const started = performance.now();
    const response = await at(new Request(`http://localhost/api/v1/plots/at?lat=${lat}&lon=${lon}`));
    const body: unknown = await response.json();
    const plot = response.status === 200 ? Plot.parse(body) : null;
    const error = plot ? null : ApiError.parse(body).error;
    const state = plot || ([400, 404].includes(response.status) && error?.message) ? "PASS" : "PARTIAL";
    const result = {
      name,
      region,
      lat,
      lon,
      state,
      httpStatus: response.status,
      durationMs: Math.round(performance.now() - started),
      id: plot?.id ?? null,
      municipality: plot?.municipality ?? null,
      error,
    };
    results.push(result);
    console.log(`${state} ${name}: HTTP ${response.status} ${plot?.id ?? error?.message}`);
  }
  await writeFile(
    new URL("../docs/backend/verification/session-d/random-plots.json", import.meta.url),
    JSON.stringify(
      {
        executedAt: new Date().toISOString(),
        seed: 20261006,
        selection:
          "Ten stratified regional anchors with seeded uniform jitter ±0.001°. No nearest-parcel substitution.",
        results,
      },
      null,
      2,
    ) + "\n",
  );
  globalThis.fetch = originalFetch;
  return results;
}

if (process.argv[1]?.endsWith("session-d-live.ts")) {
  if (process.argv[2] === "plots") await runRandomPlotsLive();
  else process.exitCode = (await runPlanningLive()) ? 1 : 0;
}
