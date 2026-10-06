import test from "node:test";
import assert from "node:assert/strict";
import {
  MemoryCounterStore,
  RedisCounterStore,
  FallbackCounterStore,
  enforceApiLimit,
  rateBucket,
  API_LIMITS,
} from "#server/http/rate-limit.ts";
import { clientAddress, keyDigest } from "#server/http/identity.ts";
import { RedisRestClient } from "#server/core/redis.ts";
import { RateLimited } from "#server/core/errors.ts";
import { errorResponse } from "#server/http/responses.ts";

const request = (path: string, headers?: HeadersInit) =>
  new Request(`http://localhost/api/v1/${path}`, { headers });
test("address precedence and buckets match clientAddress; health never consumes counters", async () => {
  assert.equal(
    clientAddress(request("geocode", { "x-real-ip": " 10.0.0.1 ", "x-forwarded-for": "forged, 10.0.0.2" })),
    "10.0.0.1",
  );
  assert.equal(clientAddress(request("geocode", { "x-forwarded-for": "forged, 10.0.0.2" })), "10.0.0.2");
  assert.equal(rateBucket("/api/v1/catalog/sources"), "light");
  assert.equal(rateBucket("/api/v1/geocode", new URLSearchParams({ q: "Firenze fg 12 part 1" })), "heavy");
  assert.equal(rateBucket("/api/v1/geocode", new URLSearchParams({ q: "Firenze F. 12 p. 340" })), "heavy");
  assert.equal(rateBucket("/api/v1/geocode", new URLSearchParams({ q: "Firenze mapp 340" })), "heavy");
  assert.equal(rateBucket("/api/v1/geocode", new URLSearchParams({ q: "Piazza Duomo" })), "light");
  assert.equal(rateBucket("/api/v1/tiles/cadastre/18/1/1"), "tiles");
  await enforceApiLimit(request("health"), {
    consume: async () => {
      throw new Error("health consumed quota");
    },
  });
});
test("anonymous buckets are independent, reset with time and return the ApiError/Retry-After contract", async () => {
  let now = 0;
  const store = new MemoryCounterStore(() => now);
  for (let n = 0; n < API_LIMITS.light.anonymous; n++)
    await enforceApiLimit(request("catalog/sources"), store);
  await assert.rejects(enforceApiLimit(request("catalog/layers"), store), (error: unknown) => {
    const response = errorResponse(error);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "60");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    return error instanceof RateLimited;
  });
  await enforceApiLimit(request("lots"), store);
  await enforceApiLimit(request("catalog/sources", { "x-real-ip": "another" }), store);
  now = 60_000;
  await enforceApiLimit(request("catalog/sources"), store);
});
test("API hashes opt in to the higher tier; invalid bearers remain anonymous and raw keys are rejected", async () => {
  const saved = process.env.PARTICELLA_API_KEYS;
  try {
    const key = "offline-test-key";
    process.env.PARTICELLA_API_KEYS = keyDigest(key);
    const store = new MemoryCounterStore();
    for (let i = 0; i <= API_LIMITS.light.anonymous; i++)
      await enforceApiLimit(request("catalog/sources", { authorization: `Bearer ${key}` }), store);
    for (let i = 0; i < API_LIMITS.light.anonymous; i++)
      await enforceApiLimit(request("catalog/sources", { authorization: "Bearer invalid" }), store);
    await assert.rejects(
      enforceApiLimit(request("catalog/sources", { authorization: "Bearer invalid" }), store),
      RateLimited,
    );
    process.env.PARTICELLA_API_KEYS = key;
    await assert.rejects(enforceApiLimit(request("lots"), store), /SHA-256/);
    delete process.env.PARTICELLA_API_KEYS;
    await enforceApiLimit(request("lots"), new MemoryCounterStore());
  } finally {
    if (saved === undefined) delete process.env.PARTICELLA_API_KEYS;
    else process.env.PARTICELLA_API_KEYS = saved;
  }
});
test("two independent instances use a shared atomic Redis EVAL and handle outage without leaking addresses", async () => {
  let count = 0;
  const commands: unknown[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    const command = JSON.parse(String(init?.body));
    commands.push(command);
    assert.equal(command[0], "EVAL");
    assert.match(command[1], /INCR/);
    assert.match(command[1], /PEXPIRE/);
    assert.doesNotMatch(command[3], /192\.0\.2\.1/);
    return Response.json({ result: [++count, 45_000] });
  };
  const redis = new RedisRestClient("https://redis.test", "fake-token", fetcher);
  const a = new RedisCounterStore(redis),
    b = new RedisCounterStore(redis);
  const settled = await Promise.allSettled(
    Array.from({ length: 61 }, (_, i) =>
      enforceApiLimit(request("catalog/sources", { "x-real-ip": "192.0.2.1" }), i % 2 ? a : b),
    ),
  );
  assert.equal(settled.filter((s) => s.status === "rejected").length, 1);
  assert.equal(commands.length, 61);
  const fallback = new FallbackCounterStore({
    consume: async () => {
      throw new Error("offline");
    },
  });
  assert.equal((await fallback.consume("key", 60_000)).count, 1);
  assert.equal((await fallback.consume("key", 60_000)).count, 2);
});

test("map tiles have their own generous bucket so panning never starves the analysis", () => {
  assert.equal(rateBucket("/api/v1/tiles/cadastre/17/1/1"), "tiles");
  assert.equal(rateBucket("/api/v1/plots/it:A564:_:60:110/layers/flood"), "heavy");
  // One Studio session: a plot, all layers and several screens of cadastral tiles.
  assert.ok(API_LIMITS.tiles.anonymous >= 10 * API_LIMITS.heavy.anonymous);
});

test("uncached tiles have a stricter per-client quota than cached ones", async () => {
  const { enforceTileUpstreamLimit, TILE_UPSTREAM_LIMIT } = await import("#server/http/rate-limit.ts");
  const store = new MemoryCounterStore();
  const req = new Request("http://x/api/v1/tiles/cadastre/17/1/1", { headers: { "x-real-ip": "5.5.5.5" } });
  for (let i = 0; i < TILE_UPSTREAM_LIMIT; i++) await enforceTileUpstreamLimit(req, store);
  await assert.rejects(enforceTileUpstreamLimit(req, store), RateLimited);
  const other = new Request("http://x/api/v1/tiles/cadastre/17/1/1", { headers: { "x-real-ip": "6.6.6.6" } });
  await enforceTileUpstreamLimit(other, store);
});

test("tiles outside Italy are blank and never reach a source or the quota", async () => {
  const { tile } = await import("#server/countries/it/tiles.ts");
  let charged = false;
  // z=12 tile over Paris.
  const bytes = await tile({ overlay: "flood", z: 12, x: 2074, y: 1408 }, undefined, async () => {
    charged = true;
  });
  assert.ok(bytes.length > 0);
  assert.equal(charged, false);
});
