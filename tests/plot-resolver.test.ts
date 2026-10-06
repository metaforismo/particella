import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryCache, canonicalKey } from "#server/core/cache.ts";
import { createPlotResolver, parseAt } from "#server/plots.ts";
import { NotFound, BadRequest } from "#server/core/errors.ts";
import { Plot } from "#contracts";
import type { CountryAdapter } from "#server/countries/types.ts";
import { fixtureText } from "./helpers.ts";
import { parseParcels } from "#server/countries/it/cadastre.ts";

const parcel = parseParcels(fixtureText("ade-rural.xml"))[0];

const plot = Plot.parse({
  id: "it:A564:_:60:110",
  country: "it",
  cadastral: {
    municipalityCode: "A564",
    section: null,
    sheet: "60",
    parcel: "110",
    label: "Foglio 60 · Particella 110",
  },
  municipality: null,
  address: null,
  centroid: { lat: 43.7, lon: 11.32 },
  geometry: parcel.geometry,
  areaM2: null,
  perimeterM: null,
  provenance: [],
});

test("warm cache avoids lookup; malformed at is still rejected", async () => {
  const storage = new MemoryCache();
  await storage.set(canonicalKey("plot:v1", plot.id), plot, 10000);
  const country = {
    plotAt: async () => {
      throw Error("unexpected spatial query");
    },
    plotById: async () => {
      throw Error("unexpected attribute query");
    },
  } as unknown as CountryAdapter;
  const resolve = createPlotResolver(country, storage);
  assert.deepEqual(await resolve(plot.id, "43.700000,11.320000"), plot);
  for (const bad of ["", "NaN,11", "91,11", "43,181", "43,11,0", "43", "43e0,11"])
    await assert.rejects(resolve(plot.id, bad), BadRequest);
  assert.throws(() => parseAt({ lat: NaN, lon: 11 }), BadRequest);
});

test("cold cache and negative ID cache use at, verify ID, and share the stored plot", async () => {
  let spatial = 0;
  let attributes = 0;
  const country = {
    plotAt: async (lat: number, lon: number) => {
      spatial++;
      assert.equal(lat, 43.7);
      assert.equal(lon, 11.32);
      return plot;
    },
    plotById: async () => {
      attributes++;
      return plot;
    },
  } as unknown as CountryAdapter;
  const storage = new MemoryCache();
  await storage.set(canonicalKey("plot:v1", plot.id), { missing: true }, 10000);
  const resolve = createPlotResolver(country, storage);
  assert.equal((await resolve(plot.id, "43.700000,11.320000")).id, plot.id);
  await resolve(plot.id);
  assert.equal(spatial, 1);
  assert.equal(attributes, 0);
  const other = "it:A564:_:60:111";
  await assert.rejects(
    resolve(other, "43.700000,11.320000"),
    (error: unknown) =>
      error instanceof NotFound &&
      error.message === "Il punto indicato non ricade nella particella richiesta.",
  );
  assert.equal(await storage.get(canonicalKey("plot:v1", other)), undefined);
});

test("without at, cold cache retains attribute lookup", async () => {
  let called = false;
  const country = {
    plotById: async (id: string) => {
      called = true;
      assert.equal(id, plot.id);
      return plot;
    },
  } as unknown as CountryAdapter;
  assert.equal((await createPlotResolver(country, new MemoryCache())(plot.id)).id, plot.id);
  assert.equal(called, true);
});

test("simultaneous cold routes share cadastral resolution across resolver factories and release failed work", async () => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  const country = {
    plotAt: async () => {
      calls++;
      await gate;
      if (fail) throw new NotFound("fixture error");
      return plot;
    },
  } as unknown as CountryAdapter;
  const storage = new MemoryCache();
  const a = createPlotResolver(country, storage),
    b = createPlotResolver(country, storage);
  const pair = [a(plot.id, "43.7,11.32"), b(plot.id, { lat: 43.7, lon: 11.32 })];
  const results = Promise.allSettled(pair);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  release();
  assert.ok((await results).every((r) => r.status === "rejected"));
  fail = false;
  assert.equal((await b(plot.id, "43.7,11.32")).id, plot.id);
  assert.equal(calls, 2);
});
