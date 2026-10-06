import { writeFile } from "node:fs/promises";
import { PlotReport } from "#contracts";
import { GET } from "../../src/app/api/v1/plots/[id]/report/route.ts";

const lots = [
  { name: "Milano", id: "it:F205:_:390:61", at: "45.464800,9.191000" },
  { name: "Bagno", id: "it:A564:_:60:110", at: "43.7,11.32" },
  { name: "Vallombrosa", id: "it:H222:_:28:60", at: "43.733000,11.556000" },
];
const lot = lots[Number(process.argv[2] ?? 0)];
if (!lot) throw Error("Pass lot index 0, 1 or 2. Run each in a fresh process for cold cache.");
const calls: { host: string; startMs: number; durationMs: number; status?: number }[] = [];
const originalFetch = globalThis.fetch;
const started = performance.now();
globalThis.fetch = async (...args) => {
  const call = {
    host: new URL(String(args[0])).host,
    startMs: performance.now() - started,
    durationMs: 0,
    status: undefined as number | undefined,
  };
  calls.push(call);
  try {
    const response = await originalFetch(...args);
    call.status = response.status;
    return response;
  } finally {
    call.durationMs = performance.now() - started - call.startMs;
  }
};
const samples = [];
for (const state of ["cold", "warm"]) {
  const response = await GET(new Request(`http://localhost/api/v1/plots/${lot.id}/report?at=${lot.at}`), {
    params: Promise.resolve({ id: lot.id }),
  });
  const body: unknown = await response.json();
  const parsed = PlotReport.safeParse(body);
  const timing = response.headers.get("Server-Timing");
  const sample = {
    state,
    httpStatus: response.status,
    timing,
    statuses: parsed.success
      ? parsed.data.layers.map(({ layer, status, headline }) => ({ layer, status, headline }))
      : body,
  };
  samples.push(sample);
  console.log(`${lot.name} ${state}: ${response.status}\n${timing?.split(", ").join("\n")}`);
}
const output = {
  executedAt: new Date().toISOString(),
  lot,
  samples,
  calls,
  scope:
    "Route handler in a fresh Node process; includes cadastre, excludes Next startup, HTTP transport and rendering.",
};
if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify(output, null, 2) + "\n");
if (samples.some((s) => s.httpStatus !== 200)) process.exitCode = 1;
