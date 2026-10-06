import { test } from "node:test";
import assert from "node:assert/strict";
import { GROUP_LABEL, LAYERS } from "../src/content/layers.ts";
import { layerCatalog } from "#server/core/layers.ts";
import { LayerGroup, LayerId } from "#contracts";

test("every server layer has UI content in the same group, and vice versa", () => {
  const ui = new Map(LAYERS.map((l) => [l.id, l]));
  for (const entry of layerCatalog) {
    const meta = ui.get(entry.id);
    assert.ok(meta, `missing UI content for ${entry.id}`);
    assert.equal(meta.group, entry.group, `group mismatch for ${entry.id}`);
  }
  for (const meta of LAYERS) {
    assert.ok(
      layerCatalog.some((entry) => entry.id === meta.id),
      `UI lists ${meta.id} but the server does not`,
    );
    assert.ok(meta.authority.trim(), `${meta.id} needs an authority`);
  }
});

test("contract enums, catalogue and group labels stay in sync", () => {
  assert.deepEqual(new Set(LayerId.options), new Set(layerCatalog.map((e) => e.id)));
  assert.deepEqual(new Set(LayerGroup.options), new Set(Object.keys(GROUP_LABEL)));
});
