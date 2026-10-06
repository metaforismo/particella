import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Plot } from "#contracts";
import { getCountry } from "#server/countries/index.ts";
import { formatNumber, formatDistance, decimalDotQuantities } from "#server/core/format.ts";

const original = globalThis.fetch;
globalThis.fetch = async (input) => {
  const u = new URL(String(input));
  let f: string;
  if (u.host === "idrogeo.isprambiente.it")
    f = u.searchParams.get("layers")?.includes("frane") ? "landslide-positive.json" : "flood-positive.json";
  else if (u.host === "mps04-ws.pi.ingv.it") f = "pga-firenze.xml";
  else if (u.host === "bio.discomap.eea.europa.eu") f = "protected-positive.json";
  else if (u.host === "tinitaly.pi.ingv.it") f = "terrain.json";
  else if (u.host === "re.jrc.ec.europa.eu") f = "solar.json";
  else if (u.host === "overpass-api.de") f = "services.json";
  else if (u.host === "geoportale.istat.it") f = "grid-rural.json";
  else if (u.host === "sitap.cultura.gov.it") f = "landscape-positive.json";
  else if (u.host === "tms.comune.fi.it") f = "planning-firenze.xml";
  else if (u.host === "www502.regione.toscana.it") f = "ucs-firenze.txt";
  else if (u.host === "image.discomap.eea.europa.eu") f = "corine.json";
  else if (u.host === "valhalla1.openstreetmap.de")
    f =
      JSON.parse(u.searchParams.get("json")!).costing === "auto"
        ? "accessibility-car.json"
        : "accessibility-walk.json";
  else if (u.host === "www1.agenziaentrate.gov.it")
    f = u.pathname.endsWith("perimetri.php")
      ? "omi-firenze.zip"
      : u.pathname.endsWith("stampaomi.php")
        ? "omi-prices.html"
        : u.searchParams.get("richiesta") === "5"
          ? "omi-semesters.json"
          : "omi-zone-list.json";
  else throw Error(`Unexpected offline host ${u.host}`);
  return new Response(readFileSync(new URL(`./fixtures/${f}`, import.meta.url)), {
    headers: {
      "Content-Type": f.endsWith("zip")
        ? "application/zip"
        : f.endsWith("html")
          ? "text/html"
          : f.endsWith("xml")
            ? "application/xml"
            : f.endsWith("txt")
              ? "text/plain"
              : "application/json",
    },
  });
};
after(() => {
  globalThis.fetch = original;
});

test("Italian quantities use decimal commas and thousands dots; identifiers are preserved", () => {
  assert.equal(formatNumber(60.1), "60,1");
  assert.equal(formatNumber(1351, 0), "1.351");
  assert.equal(formatDistance(1300), "1,3 km");
  assert.deepEqual(decimalDotQuantities("Quote 60.1 m e 1234.5 m"), ["60.1", "1234.5"]);
  assert.deepEqual(decimalDotQuantities("1.351 kWh; ODbL 1.0; https://example.test/v1.0"), []);
  assert.throws(() => formatNumber(NaN));
});

test("all seventeen providers' fixture results contain no decimal-dot quantities in headlines or notes", async () => {
  const plot = Plot.parse({
    id: "fixture:format",
    country: "it",
    cadastral: { municipalityCode: "D612", section: null, sheet: "173", parcel: "68", label: "Fixture" },
    municipality: {
      istatCode: "048017",
      cadastralCode: "D612",
      name: "Firenze",
      province: "Firenze",
      provinceCode: "FI",
      region: "Toscana",
    },
    centroid: { lat: 43.7696, lon: 11.2558 },
    geometry: null,
    areaM2: null,
    perimeterM: null,
    address: null,
    provenance: [],
  });
  const layers = getCountry("it").layers;
  assert.equal(Object.keys(layers).length, 17);
  for (const [id, provider] of Object.entries(layers)) {
    const result = await provider(plot, { signal: new AbortController().signal });
    if (id === "terrain") assert.match(result.headline, /\d,\d/);
    for (const text of [result.headline, ...result.notes])
      assert.deepEqual(decimalDotQuantities(text), [], `${id}: ${text}`);
  }
});
