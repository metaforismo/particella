import test from "node:test";
import assert from "node:assert/strict";
import { SourceStatusResponse } from "#contracts";
import {
  MemoryObservationStore,
  RedisObservationStore,
  sourceStatuses,
  recordSource,
} from "#server/core/source-status.ts";
import { probeSources } from "#server/core/source-probe.ts";
import { RedisRestClient } from "#server/core/redis.ts";
import { sources, source } from "#server/core/sources.ts";
import { HttpClient, MemoryHostLimiter } from "#server/core/http.ts";
import { MemoryCache } from "#server/core/cache.ts";
import { observeRequest } from "#server/core/observability.ts";
import { keyDigest } from "#server/http/identity.ts";
import { MemoryCounterStore } from "#server/http/rate-limit.ts";
import { GET } from "../src/app/api/v1/status/route.ts";

test("every registered source has an explicit unknown state; median recent latency differs from last state", async () => {
  const store = new MemoryObservationStore();
  const blank = SourceStatusResponse.parse(await sourceStatuses(store));
  assert.equal(blank.length, sources.length);
  assert.ok(blank.every((s) => s.state === "unknown" && s.checkedAt === null && s.medianLatencyMs === null));
  const now = Date.now();
  await store.record("nominatim", { at: now - 16 * 60_000, state: "error", durationMs: 5000 });
  await store.record("nominatim", { at: now - 3000, state: "ok", durationMs: 100 });
  await store.record("nominatim", { at: now - 2000, state: "ok", durationMs: 200 });
  await store.record("nominatim", { at: now - 1000, state: "slow", durationMs: 4000 });
  const status = (await sourceStatuses(store)).find((s) => s.sourceId === "nominatim")!;
  assert.equal(status.state, "slow");
  assert.equal(status.medianLatencyMs, 200);
  assert.equal(status.sampleCount, 3);
  assert.equal(status.scope, "instance");
  assert.equal(status.checkedAt, new Date(now - 1000).toISOString());
});
test("real HTTP miss updates health once, while a cache hit does not refresh checkedAt or sample count", async () => {
  let fetches = 0;
  const http = new HttpClient(new MemoryCache(), new MemoryHostLimiter(), async () => {
    fetches++;
    return Response.json([]);
  });
  const endpoint = source("nominatim").endpoint;
  await http.request(endpoint, { retries: 0 });
  const before = (await sourceStatuses()).find((s) => s.sourceId === "nominatim")!;
  await http.request(endpoint);
  const after = (await sourceStatuses()).find((s) => s.sourceId === "nominatim")!;
  assert.equal(fetches, 1);
  assert.equal(after.checkedAt, before.checkedAt);
  assert.equal(after.sampleCount, before.sampleCount);
  assert.equal(after.state, "ok");
  await recordSource("nominatim", 4000, true);
  assert.equal((await sourceStatuses()).find((s) => s.sourceId === "nominatim")?.state, "slow");
  const failing = new HttpClient(
    new MemoryCache(),
    new MemoryHostLimiter(),
    async () => new Response("", { status: 503 }),
  );
  await assert.rejects(failing.request(endpoint, { retries: 0 }));
  assert.equal((await sourceStatuses()).find((s) => s.sourceId === "nominatim")?.state, "error");
});
test("shared observations use a bounded atomic list and preserve timestamps across instances", async () => {
  const values: string[] = [];
  const client = new RedisRestClient("https://redis.test", "fake", async (_url, options) => {
    const command = JSON.parse(String(options?.body));
    if (command[0] === "EVAL") {
      assert.match(command[1], /LTRIM/);
      assert.match(command[1], /PEXPIRE/);
      values.unshift(command[4]);
      return Response.json({ result: 1 });
    }
    assert.equal(command[0], "LRANGE");
    return Response.json({ result: values });
  });
  const writer = new RedisObservationStore(client),
    reader = new RedisObservationStore(client);
  await writer.record("nominatim", { at: Date.now(), state: "ok", durationMs: 123 });
  const status = (await sourceStatuses(reader)).find((s) => s.sourceId === "nominatim")!;
  assert.equal(status.scope, "shared");
  assert.equal(status.medianLatencyMs, 123);
});
test("status defaults to passive and short cache; probe requires admin and sends only bounded HEADs", async () => {
  const saved = process.env.PARTICELLA_ADMIN_KEY_SHA256;
  const savedKeys = process.env.PARTICELLA_API_KEYS;
  let calls = 0;
  const fetcher: typeof fetch = async (_url, options) => {
    calls++;
    assert.equal(options?.method, "HEAD");
    assert.equal(options?.redirect, "error");
    assert.ok(options?.signal);
    return new Response(null);
  };
  try {
    delete process.env.PARTICELLA_ADMIN_KEY_SHA256;
    const passive = await GET(new Request("http://localhost/api/v1/status"));
    assert.equal(passive.status, 200);
    assert.match(passive.headers.get("cache-control")!, /s-maxage=15/);
    SourceStatusResponse.parse(await passive.json());
    assert.equal((await GET(new Request("http://localhost/api/v1/status?probe=1"))).status, 503);
    process.env.PARTICELLA_ADMIN_KEY_SHA256 = keyDigest("offline-admin");
    process.env.PARTICELLA_API_KEYS = keyDigest("offline-public");
    assert.equal(
      (
        await GET(
          new Request("http://localhost/api/v1/status?probe=1", {
            headers: { authorization: "Bearer offline-public" },
          }),
        )
      ).status,
      401,
    );
    await assert.rejects(
      probeSources(new Request("http://localhost/api/v1/status?probe=1"), fetcher),
      /amministrativa/,
    );
    assert.equal(calls, 0);
    const req = new Request("http://localhost/api/v1/status?probe=1", {
      headers: { authorization: "Bearer offline-admin" },
    });
    const counters = new MemoryCounterStore();
    await probeSources(req, fetcher, counters);
    assert.equal(calls, sources.length);
    await assert.rejects(probeSources(req, fetcher, counters), /già richiesto/);
    assert.equal(calls, sources.length);
  } finally {
    if (saved === undefined) delete process.env.PARTICELLA_ADMIN_KEY_SHA256;
    else process.env.PARTICELLA_ADMIN_KEY_SHA256 = saved;
    if (savedKeys === undefined) delete process.env.PARTICELLA_API_KEYS;
    else process.env.PARTICELLA_API_KEYS = savedKeys;
  }
});
test("request/source JSON logs redact all queries, coordinates, cadastral IDs, addresses and bearer tokens", async () => {
  const lines: string[] = [];
  const original = console.info;
  console.info = (value) => {
    lines.push(String(value));
  };
  try {
    const http = new HttpClient(new MemoryCache(), new MemoryHostLimiter(), async () => Response.json([]));
    const request = new Request(
      "https://local.test/api/v1/plots/secret-id/layers/flood?at=43.771234,11.256789&q=private-address",
      { headers: { authorization: "Bearer sensitive-key", "x-real-ip": "192.0.2.99" } },
    );
    await observeRequest(request, async () => {
      await http.request("https://example.test/search?key=source-secret&q=private-address&lat=43.771234");
      return Response.json({});
    });
    assert.equal(lines.filter((s) => JSON.parse(s).event === "request").length, 1);
    assert.equal(lines.filter((s) => JSON.parse(s).event === "source").length, 1);
    for (const line of lines) {
      assert.doesNotMatch(
        line,
        /secret-id|43\.771234|11\.256789|private-address|sensitive-key|source-secret|192\.0\.2\.99/,
      );
      const data = JSON.parse(line);
      assert.equal(data.route, "/api/v1/plots/{id}/layers/{layer}");
      assert.ok(Number.isFinite(data.durationMs));
      assert.ok(data.cache);
    }
  } finally {
    console.info = original;
  }
});
