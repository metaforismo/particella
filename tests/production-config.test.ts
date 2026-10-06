import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateStaticFields } from "@vercel/config/v1";
import { config } from "../vercel.ts";

test("actual Vercel config enables European Fluid Node functions, bounded durations, cache and no cron", async () => {
  validateStaticFields(config);
  assert.equal(config.framework, "nextjs");
  assert.deepEqual(config.regions, ["fra1"]);
  assert.equal(config.fluid, true);
  assert.equal(config.crons, undefined);
  assert.equal(config.headers?.length, 2);
  for (const file of [
    "src/app/api/v1/geocode/route.ts",
    "src/app/api/v1/lots/route.ts",
    "src/app/api/v1/plots/[id]/report/route.ts",
    "src/app/scheda/[id]/page.tsx",
  ]) {
    assert.match(await readFile(file, "utf8"), /export const maxDuration = 300/);
  }
  for (const settings of Object.values(config.functions ?? {})) assert.equal(settings.maxDuration, 300);
});
