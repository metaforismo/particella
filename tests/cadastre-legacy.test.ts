import { test } from "node:test";
import assert from "node:assert/strict";
import { parseParcels, parseZoning, parsePlotId } from "#server/countries/it/cadastre.ts";
import { fixtureText } from "./helpers.ts";

test("live AdE legacy map references and two-letter sheet suffixes preserve declared identity", () => {
  const parcels = parseParcels(fixtureText("ade-venezia-legacy-parcels.xml"));
  assert.equal(parcels[0].mapReference, "L736A0015DZ");
  assert.ok(parcels.some((p) => p.special));
  const zoning = parseZoning(fixtureText("ade-venezia-legacy-zoning.xml"));
  assert.deepEqual(zoning[0], { reference: "L736A0015DZ", sheet: "15DZ", belfiore: "L736", section: "A" });
  assert.equal(parsePlotId("it:L736:A:15DZ:3233").sheet, "15DZ");
  const rome = parseParcels(fixtureText("ade-roma-legacy-parcels.xml"));
  assert.ok(rome.every((p) => p.belfiore === "H501"));
  assert.ok(rome.some((p) => p.mapReference === "H501A048500"));
});

test("letter-only parcels returned by AdE remain addressable; mismatched administrative identity still fails", () => {
  const p = parseParcels(fixtureText("ade-milano-letter-parcel.xml"))[0];
  assert.equal(p.parcel, "H");
  assert.equal(parsePlotId("it:F205:_:390:H").parcel, "H");
  assert.throws(() =>
    parseParcels(fixtureText("ade-milano-letter-parcel.xml").replace(/F205_039000/g, "D612_039000")),
  );
  for (const id of ["it:L736:A:15DZZ:3233", "it:F205:_:390:STRADA001"]) assert.throws(() => parsePlotId(id));
});
