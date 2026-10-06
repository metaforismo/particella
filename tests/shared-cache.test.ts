import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryCache } from "#server/core/cache.ts";
import { RedisRestCache, FallbackCache } from "#server/core/shared-cache.ts";

test("optional Redis cache round-trips binary payloads and uses explicit expiry and opaque keys", async () => {
  let value: string | null = null;
  const commands: unknown[][] = [];
  const remote = new RedisRestCache("https://redis.example.test", "test-token", async (_input, options) => {
    assert.equal(new Headers(options?.headers).get("Authorization"), "Bearer test-token");
    const cmd = JSON.parse(String(options?.body));
    commands.push(cmd);
    if (cmd[0] === "SET") {
      value = cmd[2];
      return Response.json({ result: "OK" });
    }
    return Response.json({ result: value });
  });
  const original = { bytes: new Uint8Array([0, 128, 255]), retrievedAt: "2026-10-06T00:00:00Z" };
  assert.equal(await remote.get("plot:private"), undefined);
  await remote.set("plot:private", original, 1000);
  assert.deepEqual(await remote.get("plot:private"), original);
  assert.deepEqual(commands[1].slice(-2), ["PX", 1000]);
  assert.ok(!String(commands[1][1]).includes("private"));
});

test("cache outage falls back to bounded local memory and opens circuit without provider failure", async () => {
  let attempts = 0;
  let now = 0;
  const shared = {
    get: async () => {
      attempts++;
      throw Error("outage");
    },
    set: async () => {
      attempts++;
      throw Error("outage");
    },
  };
  const cache = new FallbackCache(new MemoryCache(2, () => now), shared, () => now);
  assert.equal(await cache.get("missing"), undefined);
  assert.equal(attempts, 1);
  await cache.set("data", { ok: true }, 1000);
  assert.deepEqual(await cache.get("data"), { ok: true });
  assert.equal(await cache.get("missing"), undefined);
  assert.equal(attempts, 1);
  now = 30001;
  assert.equal(await cache.get("data"), undefined);
  assert.equal(attempts, 2);
});

test("shared cache rejects unsafe configuration and corrupt envelopes; fallback isolates both", async () => {
  assert.throws(() => new RedisRestCache("http://cache.test", "token"));
  const remote = new RedisRestCache("https://cache.test", "token", async () =>
    Response.json({ result: "corrupt" }),
  );
  await assert.rejects(remote.get("data"));
  const cache = new FallbackCache(new MemoryCache(), remote);
  assert.equal(await cache.get("data"), undefined);
  await cache.set("data", 7, 1000);
  assert.equal(await cache.get("data"), 7);
});
