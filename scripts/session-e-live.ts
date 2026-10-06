import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import covers from "@turf/boolean-point-in-polygon";
import { GeocodeResult, Plot, LayerId } from "#contracts";
import { GET as geocode } from "../src/app/api/v1/geocode/route.ts";
import { POST as lots } from "../src/app/api/v1/lots/route.ts";
import { GET as byId } from "../src/app/api/v1/plots/[id]/route.ts";
import { plotAt } from "#server/countries/it/cadastre.ts";
import { resolvePlot, getPlotLayer } from "#server/plots.ts";

export async function runCadastralLive() {
  const results: { check: string; state: "PASS" | "FAIL" | "PARTIAL"; detail: unknown }[] = [];
  async function check(name: string, action: () => Promise<unknown>) {
    const start = performance.now();
    try {
      const detail = await action();
      results.push({
        check: name,
        state: "PASS",
        detail: { seconds: (performance.now() - start) / 1000, value: detail },
      });
      console.log(`PASS ${name}`);
      return detail;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      results.push({ check: name, state: "FAIL", detail });
      console.log(`FAIL ${name}: ${detail}`);
      return undefined;
    }
  }
  async function search(q: string) {
    const response = await geocode(new Request(`http://localhost/api/v1/geocode?q=${encodeURIComponent(q)}`));
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    const result = GeocodeResult.parse(body[0]);
    assert.equal(result.kind, "parcel");
    const plot = await resolvePlot(result.id);
    assert.ok(covers([result.center.lon, result.center.lat], plot.geometry!, { ignoreBoundary: true }));
    // Same spatial opening path used by the current frontend.
    assert.equal((await plotAt(result.center.lat, result.center.lon)).id, result.id);
    return result;
  }
  for (const q of [
    "Agliè foglio 51 particella 1",
    "Alassio foglio 1 particella 1",
    "Acquasparta foglio 1 particella 1",
    "Agrigento foglio 191 particella 1",
    "Abano Terme foglio 22 particella 1",
    "Firenze, foglio 150B, particella 782",
  ])
    await check(q, () => search(q));
  const a = (await check("lot component 109", () => search("Bagno a Ripoli fg 60 mapp 109"))) as
    GeocodeResult | undefined;
  const b = (await check("lot component 110", () => search("Bagno a Ripoli fg 60 mapp 110"))) as
    GeocodeResult | undefined;
  let lot: Plot | undefined;
  if (a && b) {
    lot = (await check("POST lotto composto and shared GET URL", async () => {
      const response = await lots(
        new Request("http://localhost/api/v1/lots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parcels: [
              { id: b.id, at: b.center },
              { id: a.id, at: a.center },
            ],
          }),
        }),
      );
      const body = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body));
      const lot = Plot.parse(body);
      assert.equal(lot.geometry?.type, "MultiPolygon");
      assert.equal(lot.parcels?.length, 2);
      assert.ok(covers([lot.centroid.lon, lot.centroid.lat], lot.geometry!, { ignoreBoundary: true }));
      const at = lot.parcels!.map((p) => `${p.at.lat},${p.at.lon}`).join(";");
      const get = await byId(
        new Request(
          `http://localhost/api/v1/plots/${encodeURIComponent(lot.id)}?at=${encodeURIComponent(at)}`,
        ),
        { params: Promise.resolve({ id: lot.id }) },
      );
      assert.equal(get.status, 200);
      assert.equal(Plot.parse(await get.json()).id, lot.id);
      return lot;
    })) as Plot | undefined;
  }
  if (lot)
    await Promise.all(
      LayerId.options.map(async (layer) => {
        const result = await getPlotLayer(lot!.id, layer);
        const state = ["unavailable", "error", "partial"].includes(result.status) ? "PARTIAL" : "PASS";
        results.push({ check: `compound layer ${layer}`, state, detail: result });
        console.log(`${state} compound layer ${layer}: ${result.status}`);
      }),
    );
  await writeFile(
    "docs/backend/verification/session-e-live.json",
    JSON.stringify({ retrievedAt: new Date().toISOString(), results }, null, 2) + "\n",
  );
  return !results.some((r) => r.state === "FAIL");
}
