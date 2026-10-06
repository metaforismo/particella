import { test, after } from "node:test";
import assert from "node:assert/strict";
import { Plot, LayerResult } from "#contracts";
import { planning } from "#server/countries/it/layers/planning.ts";
import {
  parseLombardiaPlanning,
  parseTorinoPlanning,
  planningArea,
} from "#server/countries/it/layers/planning-regional.ts";
import { fixtureJson, fixtureText } from "./helpers.ts";
import { decimalDotQuantities } from "#server/core/format.ts";

function lot(istat: string, belfiore: string, name: string, region: string, lat: number, lon: number) {
  return Plot.parse({
    id: `fixture:${istat}`,
    country: "it",
    cadastral: {
      municipalityCode: belfiore,
      section: null,
      sheet: "0",
      parcel: "0",
      label: "Fixture puntuale",
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
}
const original = globalThis.fetch;
globalThis.fetch = async (input) => {
  const u = new URL(String(input));
  const name =
    u.host === "www.cartografia.servizirl.it"
      ? u.searchParams.get("geometry")!.startsWith("9.6773")
        ? "planning-pgt-identify-bergamo.json"
        : "planning-pgt-identify-milano.json"
      : u.host === "geomap.reteunitaria.piemonte.it"
        ? "planning-torino-point.txt"
        : u.host === "idt2-geoserver.regione.veneto.it"
          ? "planning-veneto-sona.json"
          : u.host === "siena.ldpgis.it"
            ? "planning-siena-point.json"
            : null;
  if (!name) throw Error(`Unexpected offline host ${u.host}`);
  return new Response(fixtureText(name), {
    headers: { "Content-Type": name.endsWith("json") ? "application/json" : "text/plain" },
  });
};
after(() => {
  globalThis.fetch = original;
});

test("official live planning fixtures preserve zones and codes across Lombardia, Torino and Siena", async () => {
  for (const p of [
    lot("015146", "F205", "Milano", "Lombardia", 45.4648, 9.191),
    lot("016024", "A794", "Bergamo", "Lombardia", 45.6983, 9.6773),
    lot("001272", "L219", "Torino", "Piemonte", 45.06, 7.67),
    lot("052032", "I726", "Siena", "Toscana", 43.3186, 11.3308),
    lot("023083", "I826", "Sona", "Veneto", 45.43554332, 10.8777442),
  ]) {
    const r = LayerResult.parse(await planning(p, { signal: new AbortController().signal }));
    assert.equal(r.status, "ok");
    assert.equal(r.scope, "point");
    assert.equal(r.provenance[0].license, p.municipality!.region === "Veneto" ? "IODL 2.0" : "CC BY 4.0");
    assert.ok(r.metrics.some((m) => m.key.startsWith("code-") && m.value !== null));
    for (const t of [r.headline, ...r.notes]) assert.deepEqual(decimalDotQuantities(t), []);
    if (p.municipality!.name === "Torino") {
      assert.match(r.headline, /Residenza R2/);
      assert.match(r.headline, /Storico Ambientale 3/);
      assert.ok(r.notes.some((n) => n.includes("salvaguardia")));
    }
    if (p.municipality!.name === "Sona") {
      assert.match(r.headline, /Zona per Servizi/);
      assert.equal(r.metrics.filter((m) => m.key.startsWith("zone-")).length, 1);
    }
    if (p.municipality!.name === "Siena") assert.match(r.headline, /zona A, ambito CS2/);
  }
});

test("planning rejects foreign municipalities and truncated/malformed responses; confirmed empties remain empty", () => {
  assert.throws(() => parseLombardiaPlanning(fixtureJson("planning-pgt-identify-milano.json"), "016024"));
  assert.throws(() => parseLombardiaPlanning({ results: [], exceededTransferLimit: true }, "015146"));
  assert.deepEqual(parseLombardiaPlanning(fixtureJson("planning-pgt-identify-lodi.json"), "098031"), []);
  assert.deepEqual(parseTorinoPlanning(fixtureText("planning-torino-empty.txt")), []);
  assert.throws(() => parseTorinoPlanning("<html>maintenance</html>"));
  assert.throws(() =>
    parseTorinoPlanning("GetFeatureInfo results:\nLayer 'ZonediPiano'\n  Feature 1:\n    broken"),
  );
});

test("unconnected regions and inconsistent ISTAT/Belfiore remain explicitly outside coverage", async () => {
  for (const p of [
    lot("037006", "A944", "Bologna", "Emilia-Romagna", 44.4949, 11.3426),
    lot("058091", "H501", "Roma", "Lazio", 41.9, 12.5),
    lot("015146", "A794", "Milano", "Lombardia", 45.46, 9.19),
  ]) {
    if (p.municipality!.name === "Milano") p.cadastral.municipalityCode = "F205";
    assert.equal(planningArea(p), null);
    const r = await planning(p, { signal: new AbortController().signal });
    assert.equal(r.status, "outside_coverage");
    assert.ok(r.notes.some((n) => n.includes("geoportale")));
  }
});
