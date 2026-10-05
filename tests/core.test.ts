import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryCache, canonicalKey } from "#server/core/cache.ts";
import {
  HttpClient,
  retryAfterMs,
  USER_AGENT,
  MemoryHostLimiter,
  canonicalUrl,
  type HostLimiter,
} from "#server/core/http.ts";
import { safeRequestUrl } from "#server/core/provenance.ts";
import { apiError, OutsideCoverage, UpstreamError, RateLimited } from "#server/core/errors.ts";
import { runLayer, layerResult } from "#server/core/layers.ts";
import type { Plot } from "#contracts";

const immediate: HostLimiter = { acquire: async () => () => {} };

test("cache evicts by byte budget and oversized payloads are not retained", async () => {
  const storage = new MemoryCache(100, Date.now, 1200);
  await storage.set("first", new Uint8Array(200), 1000);
  await storage.set("second", new Uint8Array(200), 1000);
  await storage.set("third", new Uint8Array(200), 1000);
  await storage.set("fourth", new Uint8Array(200), 1000);
  await storage.get("second");
  await storage.set("fifth", new Uint8Array(200), 1000);
  await storage.set("sixth", new Uint8Array(200), 1000);
  assert.equal(await storage.get("first"), undefined);
  assert.ok(await storage.get("second"));
  await storage.set("oversized", new Uint8Array(310), 1000);
  assert.equal(await storage.get("oversized"), undefined);
});

test("429 retries respect Retry-After when the deadline allows another attempt", async () => {
  let calls = 0;
  const start = Date.now();
  const client = new HttpClient(new MemoryCache(), immediate, async () => {
    return ++calls === 1
      ? new Response("busy", { status: 429, headers: { "Retry-After": "0.5" } })
      : new Response("ok");
  });
  await client.request("https://example.test/rate-retry", { timeoutMs: 2000 });
  assert.equal(calls, 2);
  assert.ok(Date.now() - start >= 490);
});

test("deadline cancels a response stream that never sends another chunk", async () => {
  let cancelled = false;
  const client = new HttpClient(
    new MemoryCache(),
    immediate,
    async () =>
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
      ),
  );
  const hold = setTimeout(() => {}, 200);
  try {
    await assert.rejects(client.request("https://example.test/body", { timeoutMs: 20 }), UpstreamError);
    assert.equal(cancelled, true);
  } finally {
    clearTimeout(hold);
  }
});

test("LRU eviction, TTL, defensive copies, canonical keys", async () => {
  let now = 0;
  const cache = new MemoryCache(2, () => now);
  await cache.set("a", { n: 1 }, 10);
  await cache.set("b", 2, 100);
  const a = await cache.get<{ n: number }>("a");
  a!.n = 99;
  assert.equal((await cache.get<{ n: number }>("a"))?.n, 1);
  await cache.set("c", 3, 100);
  assert.equal(await cache.get("b"), undefined);
  now = 11;
  assert.equal(await cache.get("a"), undefined);
  assert.equal(
    canonicalKey("x", { a: 1, b: { y: 3, x: 2 } }),
    canonicalKey("x", { b: { x: 2, y: 3 }, a: 1 }),
  );
  assert.equal(canonicalUrl("https://example.test/?b=2&a=1#x"), "https://example.test/?a=1&b=2");
});

test("requests deduplicate and cache with original retrieval timestamp", async () => {
  let calls = 0;
  const client = new HttpClient(new MemoryCache(), immediate, async (_url, init) => {
    calls++;
    assert.equal(new Headers(init?.headers).get("User-Agent"), USER_AGENT);
    await new Promise((resolve) => setTimeout(resolve, 5));
    return new Response('{"ok":true}', { headers: { "Content-Type": "application/json" } });
  });
  const [a, b] = await Promise.all([
    client.request("https://example.test/?b=2&a=1"),
    client.request("https://example.test/?a=1&b=2"),
  ]);
  const c = await client.request("https://example.test/?a=1&b=2");
  assert.equal(calls, 1);
  assert.equal(a.retrievedAt, b.retrievedAt);
  assert.equal(a.retrievedAt, c.retrievedAt);
});

test("only transient status retries; failures have short negative cache", async () => {
  let calls = 0;
  const client = new HttpClient(
    new MemoryCache(),
    immediate,
    async () => new Response("missing", { status: ++calls === 1 ? 503 : 200 }),
  );
  assert.equal(
    new TextDecoder().decode((await client.request("https://example.test/retry")).bytes),
    "missing",
  );
  assert.equal(calls, 2);
  let permanentCalls = 0;
  const permanent = new HttpClient(new MemoryCache(), immediate, async () => {
    permanentCalls++;
    return new Response("missing", { status: 404 });
  });
  await assert.rejects(permanent.request("https://example.test/missing"), UpstreamError);
  await assert.rejects(permanent.request("https://example.test/missing"), UpstreamError);
  assert.equal(permanentCalls, 1);
});

test("Retry-After seconds and date are honored within a request deadline", async () => {
  assert.equal(retryAfterMs("2"), 2000);
  assert.equal(retryAfterMs("Thu, 01 Jan 1970 00:00:05 GMT", 0), 5000);
  assert.equal(retryAfterMs("invalid"), null);
  let calls = 0;
  const client = new HttpClient(new MemoryCache(), immediate, async () => {
    calls++;
    return new Response("busy", { status: 429, headers: { "Retry-After": "5" } });
  });
  await assert.rejects(client.request("https://example.test/busy", { timeoutMs: 20 }), RateLimited);
  assert.equal(calls, 1);
});

test("timeout covers hanging fetch and body streaming", async () => {
  const client = new HttpClient(
    new MemoryCache(),
    immediate,
    async (_url, options) =>
      new Promise((_resolve, reject) =>
        options?.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
      ),
  );
  const hold = setTimeout(() => {}, 100);
  await assert.rejects(client.request("https://example.test/slow", { timeoutMs: 15 }), UpstreamError);
  clearTimeout(hold);
});

test("host limiter spaces starts and limits concurrency", async () => {
  const limiter = new MemoryHostLimiter();
  const policy = { concurrency: 1, requestsPerSecond: 50 };
  const start = Date.now();
  const release = await limiter.acquire("fixture", policy, new AbortController().signal);
  let second = false;
  const waiting = limiter.acquire("fixture", policy, new AbortController().signal).then((done) => {
    second = true;
    return done;
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(second, false);
  release();
  const done = await waiting;
  assert.ok(Date.now() - start >= 19);
  done();
});

test("request provenance removes credentials and token-like query fields", () => {
  const result = new URL(
    safeRequestUrl("https://user:password@example.test/data?api_key=hidden&signature=secret&layer=P1")!,
  );
  assert.equal(result.username, "");
  assert.equal(result.password, "");
  assert.equal(result.searchParams.get("api_key"), null);
  assert.equal(result.searchParams.get("signature"), null);
  assert.equal(result.searchParams.get("layer"), "P1");
  assert.equal(apiError(new OutsideCoverage()).status, 404);
});

test("per-layer deadline resolves a hung provider without failing another layer", async () => {
  const plot = {
    id: "test-timeout",
    geometry: null,
    centroid: { lat: 43.7, lon: 11.32 },
    municipality: null,
  } as Plot;
  let aborted = false;
  const hung = runLayer(
    "solar",
    plot,
    async (_p, { signal }) => {
      signal.addEventListener("abort", () => {
        aborted = true;
      });
      return new Promise(() => {});
    },
    15,
  );
  const healthy = runLayer(
    "flood",
    plot,
    async () => layerResult("flood", { status: "empty", headline: "Nessun oggetto restituito." }),
    100,
  );
  const [a, b] = await Promise.all([hung, healthy]);
  assert.equal(a.status, "unavailable");
  assert.equal(b.status, "empty");
  assert.equal(aborted, true);
});

test("generic HTTP accepts legitimate status, remark and error fields; source validators reject their own errors even from cache", async () => {
  let calls = 0;
  const client = new HttpClient(new MemoryCache(), immediate, async () => {
    calls++;
    return new Response(JSON.stringify({ status: "complete", remark: "metadata", error: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  });
  await client.request("https://example.test/legitimate-fields");
  await assert.rejects(
    client.request("https://example.test/legitimate-fields", {
      validate: () => {
        throw new UpstreamError("Specific source failure");
      },
    }),
    UpstreamError,
  );
  assert.equal(calls, 1);
  const html = new HttpClient(
    new MemoryCache(),
    immediate,
    async () => new Response("<html>official data</html>", { headers: { "Content-Type": "text/html" } }),
  );
  await html.request("https://example.test/source-html", {
    validate: (p) => assert.match(new TextDecoder().decode(p.bytes), /official data/),
  });
  await assert.rejects(html.request("https://example.test/unexpected-html"), UpstreamError);
});

test("opaque positional OMI query is not encoded into a parameter key", () => {
  const input =
    "https://www1.agenziaentrate.gov.it/servizi/geopoi_omi/stampaomi.php?D612/FI00001135/20252/R/B5/11.2558/43.7696";
  assert.equal(canonicalUrl(input), input);
});
