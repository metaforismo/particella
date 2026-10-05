import { test } from "node:test";
import assert from "node:assert/strict";
import { GeocodeResult } from "#contracts";
import { z } from "zod";
import { GET } from "../src/app/api/v1/geocode/route.ts";
import { parseNominatim, parsePhoton } from "#server/countries/it/geocode.ts";
import { fixtureJson, fixtureText } from "./helpers.ts";

const cases = [
  ["Via Tortona 31 Milano", "geocode-tortona.json", { lat: 45.4517, lon: 9.1628 }, "Via Tortona 31"],
  ["Bagno a Ripoli", "geocode-bagno.json", { lat: 43.7522, lon: 11.32 }, "Bagno a Ripoli"],
  [
    "Piazza della Signoria Firenze",
    "geocode-signoria.json",
    { lat: 43.7696, lon: 11.2558 },
    "Piazza della Signoria",
  ],
] as const;

const originalFetch = globalThis.fetch;

let photonCalls = 0;

globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  if (url.hostname === "nominatim.openstreetmap.org") {
    const selected = cases.find(([query]) => query === url.searchParams.get("q"));
    if (!selected) return new Response("Rate limit", { status: 429, headers: { "Retry-After": "60" } });
    return new Response(fixtureText(selected[1]), { headers: { "Content-Type": "application/json" } });
  }
  if (url.hostname === "photon.komoot.io") {
    photonCalls++;
    return new Response(fixtureText("photon-tortona.json"), {
      headers: { "Content-Type": "application/json" },
    });
  }
  throw Error(`Unexpected offline host ${url.host}`);
};

test("the three real Studio searches return sensible locations and labels through the route", async () => {
  for (const [q, name, expected, label] of cases) {
    const response = await GET(new Request(`http://localhost/api/v1/geocode?q=${encodeURIComponent(q)}`));
    assert.equal(response.status, 200);
    const result = z.array(GeocodeResult).parse(await response.json())[0];
    assert.equal(result.label, label);
    assert.ok(Math.abs(result.center.lat - expected.lat) < 0.003);
    assert.ok(Math.abs(result.center.lon - expected.lon) < 0.003);
    assert.equal(parseNominatim(fixtureJson(name))[0].label, label);
  }
  assert.equal(parseNominatim(fixtureJson("geocode-tortona.json"))[0].kind, "address");
  assert.equal(parseNominatim(fixtureJson("geocode-tortona.json"))[0].secondary, "Milano, Lombardia, Italia");
});

test("Nominatim 429 degrades to real Photon results with a valid UI payload and a street number", async () => {
  const response = await GET(
    new Request("http://localhost/api/v1/geocode?q=Via%20Tortona%2031%20Milano%20fallback"),
  );
  assert.equal(response.status, 200);
  const result = z.array(GeocodeResult).parse(await response.json())[0];
  assert.equal(result.label, "Via Tortona 31");
  assert.equal(result.kind, "address");
  assert.equal(photonCalls, 1);
  assert.equal(parsePhoton(fixtureJson("photon-tortona.json"))[0].label, "Via Tortona 31");
});

test.after(() => {
  globalThis.fetch = originalFetch;
});
