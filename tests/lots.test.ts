import { test } from "node:test";
import assert from "node:assert/strict";
import { Plot, LotInput, LayerId } from "#contracts";
import { aggregatePlots, createLot, parseLotId } from "#server/lots.ts";
import { createPlotResolver } from "#server/plots.ts";
import { MemoryCache, cache, canonicalKey } from "#server/core/cache.ts";
import { measurements, representativePoint, coversPoint } from "#server/geo/index.ts";
import covers from "@turf/boolean-point-in-polygon";
import { parseParcels } from "#server/countries/it/cadastre.ts";
import { layerResult, runLayer } from "#server/core/layers.ts";
import { BadRequest } from "#server/core/errors.ts";
import { POST } from "../src/app/api/v1/lots/route.ts";
import { GET as byId } from "../src/app/api/v1/plots/[id]/route.ts";
import type { CountryAdapter } from "#server/countries/types.ts";
import { fixtureText } from "./helpers.ts";

const plots = parseParcels(fixtureText("ade-rural.xml")).map((parcel) =>
  Plot.parse({
    id: `it:A564:_:60:${parcel.parcel}`,
    country: "it",
    cadastral: {
      municipalityCode: "A564",
      section: null,
      sheet: "60",
      parcel: parcel.parcel,
      label: `Foglio 60 · Particella ${parcel.parcel}`,
    },
    municipality: null,
    address: null,
    centroid: representativePoint(parcel.geometry),
    geometry: parcel.geometry,
    ...measurements(parcel.geometry),
    provenance: [],
  }),
);

function strictInside(plot: Plot) {
  assert.ok(covers([plot.centroid.lon, plot.centroid.lat], plot.geometry!, { ignoreBoundary: true }));
}

test("interior points stay out of the holes in real Rome and Venice parcel geometries", () => {
  for (const name of [
    "ade-roma-legacy-parcels.xml",
    "ade-venezia-legacy-parcels.xml",
    "ade-debug-parcel.xml",
  ]) {
    for (const parcel of parseParcels(fixtureText(name))) {
      const p = representativePoint(parcel.geometry);
      assert.ok(covers([p.lon, p.lat], parcel.geometry, { ignoreBoundary: true }));
    }
  }
});

test("real adjacent parcels form an order-independent MultiPolygon union; shared edges disappear from perimeter", () => {
  const lot = aggregatePlots(plots);
  const reversed = aggregatePlots([...plots].reverse());
  assert.equal(lot.id, "it:A564:_:60:109+it:A564:_:60:110");
  assert.equal(lot.id, reversed.id);
  assert.deepEqual(lot.geometry, reversed.geometry);
  assert.equal(lot.geometry?.type, "MultiPolygon");
  assert.equal(lot.cadastral.label, "Foglio 60 · Particelle 109, 110");
  assert.ok(Math.abs(lot.areaM2! - plots.reduce((sum, p) => sum + p.areaM2!, 0)) < 1);
  assert.ok(lot.perimeterM! < plots.reduce((sum, p) => sum + p.perimeterM!, 0));
  assert.equal(lot.parcels?.length, 2);
  strictInside(lot);
  assert.ok(lot.provenance.some((p) => p.method === "computed" && !p.isOfficial));
  for (const p of plots) strictInside(p);
  for (const component of lot.parcels!)
    assert.ok(coversPoint(plots.find((p) => p.id === component.id)!.geometry!, component.at));
});

test("compound input rejects duplicates, nested lots, different municipalities and excessive counts before lookup", async () => {
  let calls = 0;
  const resolve = async () => {
    calls++;
    return plots[0];
  };
  for (const ids of [
    [plots[0].id, plots[0].id],
    [plots[0].id, "it:D612:_:150B:782"],
    Array.from({ length: 21 }, (_, i) => `it:A564:_:60:${i + 1}`),
  ]) {
    assert.throws(() => parseLotId(ids.join("+")), BadRequest);
    await assert.rejects(createLot({ parcels: ids.map((id) => ({ id })) }, resolve));
  }
  assert.equal(calls, 0);
  assert.equal(LotInput.safeParse({ parcels: [{ id: plots[0].id }] }).success, false);
  await assert.rejects(
    createLot({ parcels: [{ id: plots[0].id, at: { lat: 91, lon: 11 } }, { id: plots[1].id }] }, resolve),
  );
  assert.equal(calls, 0);
});

test("a compound URL resolves on a cold instance using one verified point per component", async () => {
  const country = {
    plotAt: async (lat: number, lon: number) =>
      plots.find((p) => p.centroid.lat === lat && p.centroid.lon === lon)!,
    plotById: async () => {
      throw Error("unexpected cold attribute lookup");
    },
  } as unknown as CountryAdapter;
  const resolve = createPlotResolver(country, new MemoryCache());
  const ids = plots.map((p) => p.id).join("+"),
    points = plots.map((p) => `${p.centroid.lat},${p.centroid.lon}`).join(";");
  const lot = await resolve(ids, points);
  assert.equal(lot.id, ids);
  strictInside(lot);
  await assert.rejects(resolve(ids, "43.7,11.32"), /un punto per ogni/);
  await assert.rejects(resolve(ids, "NaN,11;43.7,11.32"), BadRequest);
});

test("POST lots and GET compound ID use the shared additive Plot contract", async () => {
  for (const p of plots) await cache.set(canonicalKey("plot:v1", p.id), p, 10000);
  const response = await POST(
    new Request("http://localhost/api/v1/lots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcels: plots.map((p) => ({ id: p.id, at: p.centroid })) }),
    }),
  );
  assert.equal(response.status, 200);
  const lot = Plot.parse(await response.json());
  const get = await byId(new Request(`http://localhost/api/v1/plots/${encodeURIComponent(lot.id)}`), {
    params: Promise.resolve({ id: lot.id }),
  });
  assert.equal(get.status, 200);
  assert.equal(Plot.parse(await get.json()).id, lot.id);
});

test("every layer receives union geometry and declared interior point, and reports its compound scope", async () => {
  const lot = aggregatePlots(plots);
  for (const id of LayerId.options) {
    let called = false;
    const result = await runLayer(id, lot, async (p) => {
      called = true;
      assert.deepEqual(p.geometry, lot.geometry);
      assert.deepEqual(p.centroid, lot.centroid);
      return layerResult(id, { scope: id === "flood" ? "parcel" : "point" });
    });
    assert.ok(called);
    assert.equal(result.status, "ok");
    assert.ok(result.notes.some((n) => n.includes("lotto composto") || n.includes("Lotto composto")));
  }
});
