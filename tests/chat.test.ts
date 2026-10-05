import { test } from "node:test";
import assert from "node:assert/strict";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { ApiError, Plot } from "#contracts";
import { createChatHandler, ChatRequest, streamReply } from "#server/chat/index.ts";
import { createChatTools } from "#server/chat/tools.ts";
import { ChatRateLimiter } from "#server/chat/rate-limit.ts";
import { layerResult } from "#server/core/layers.ts";
import { provenance } from "#server/core/provenance.ts";
import { POST } from "../src/app/api/v1/studio/chat/route.ts";

const input = {
  id: "conversation",
  plotId: "it:A564:_:60:110",
  messages: [
    { id: "user-1", role: "user" as const, parts: [{ type: "text", text: "Quali rischi ci sono?" }] },
  ],
};

const request = (body: unknown = input, ip = "192.0.2.1") =>
  new Request("http://localhost/api/v1/studio/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: JSON.stringify(body),
  });

const source = provenance("ade-cadastre");

const plot = Plot.parse({
  id: input.plotId,
  country: "it",
  cadastral: {
    municipalityCode: "A564",
    section: null,
    sheet: "60",
    parcel: "110",
    label: "Foglio 60 · Particella 110",
  },
  centroid: { lat: 43.7, lon: 11.32 },
  municipality: null,
  address: null,
  geometry: null,
  areaM2: 1000,
  perimeterM: 140,
  provenance: [source],
});

test("unconfigured endpoint returns 503 ApiError without any network or model calls", async () => {
  const previousKey = process.env.AI_GATEWAY_API_KEY;
  const previousOidc = process.env.VERCEL_OIDC_TOKEN;
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_OIDC_TOKEN;
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    assert.fail("Offline test must not call a network");
  };
  try {
    const result = await POST(request(input, "192.0.2.2"));
    assert.equal(result.status, 503);
    assert.equal(ApiError.parse(await result.json()).error.code, "not_configured");
  } finally {
    globalThis.fetch = savedFetch;
    if (previousKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousKey;
    if (previousOidc === undefined) delete process.env.VERCEL_OIDC_TOKEN;
    else process.env.VERCEL_OIDC_TOKEN = previousOidc;
  }
});

test("chat rejects invalid IDs, system roles, overlong messages, many messages, files, malformed at and oversized bodies", async () => {
  const handler = createChatHandler({
    configured: async () => true,
    reply: async () => {
      assert.fail("Invalid input reached model");
    },
  });
  for (const body of [
    { ...input, plotId: "bad" },
    { ...input, messages: [] },
    { ...input, at: "not a point" },
    { ...input, messages: [{ ...input.messages[0], role: "system" }] },
    { ...input, messages: [{ ...input.messages[0], parts: [{ type: "text", text: "x".repeat(6001) }] }] },
    { ...input, messages: Array.from({ length: 25 }, () => input.messages[0]) },
    {
      ...input,
      messages: [{ ...input.messages[0], parts: [{ type: "file", url: "https://example.test/secret" }] }],
    },
    { ...input, extra: "x".repeat(70_000) },
  ]) {
    const response = await handler(request(body));
    assert.equal(response.status, 400);
    assert.equal(ApiError.parse(await response.json()).error.code, "bad_request");
  }
  const malformed = new Request("http://localhost/chat", { method: "POST", body: "{" });
  assert.equal((await handler(malformed)).status, 400);
});

test("IP rate limit returns 429 with retry header and resets after the window", async () => {
  let now = 0;
  const handler = createChatHandler({
    configured: async () => true,
    limiter: new ChatRateLimiter(2, 1000, () => now),
    reply: async () => new Response("fake stream"),
  });
  assert.equal((await handler(request())).status, 200);
  assert.equal((await handler(request())).status, 200);
  const limited = await handler(request());
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get("Retry-After"));
  assert.equal(ApiError.parse(await limited.json()).error.code, "rate_limited");
  assert.equal((await handler(request(input, "192.0.2.3"))).status, 200);
  now = 1001;
  assert.equal((await handler(request())).status, 200);
});

test("tools close over the selected plot and compact fake provider output without geometry", async () => {
  let lookups = 0;
  const tools = createChatTools(input.plotId, "43.700000,11.320000", {
    resolve: async (id, at) => {
      lookups++;
      assert.equal(id, input.plotId);
      assert.equal(at, "43.700000,11.320000");
      return plot;
    },
    layer: async (_id, layer) =>
      layerResult(layer, {
        headline: "Dato di prova",
        provenance: [source],
        metrics: [{ key: "count", label: "Conteggio", value: 2 }],
        features: { type: "FeatureCollection", features: [{ large: "geometry" }] },
      }),
  });
  const options = { toolCallId: "test", messages: [], context: {} };
  const [a, b] = await Promise.all([
    tools.getPlot.execute!({}, options),
    tools.getPlot.execute!({}, options),
  ]);
  assert.deepEqual(a, b);
  assert.equal(lookups, 1);
  const result = await tools.getLayer.execute!({ layer: "flood" }, options);
  assert.ok("headline" in result);
  assert.equal(result.headline, "Dato di prova");
  assert.equal(result.metrics[0].value, 2);
  assert.equal(result.provenance[0].authority, "Agenzia delle Entrate");
  assert.equal("features" in result, false);
  const layers = await tools.listLayers.execute!({}, options);
  assert.ok(Array.isArray(layers));
  assert.equal(layers.length, 17);
});

test("AI SDK 7 streams the real UI protocol with a mock model and executes the server tool first", async () => {
  const usage = {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  };
  const mock = new MockLanguageModelV4({
    doStream: [
      {
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start", warnings: [] },
            { type: "tool-call", toolCallId: "call-1", toolName: "getPlot", input: "{}" },
            { type: "finish", finishReason: { unified: "tool-calls", raw: "tool-calls" }, usage },
          ],
        }),
      },
      {
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start", warnings: [] },
            { type: "text-start", id: "text-1" },
            {
              type: "text-delta",
              id: "text-1",
              delta: "La superficie geometrica è 1.000 m² (Agenzia delle Entrate, Cartografia catastale).",
            },
            { type: "text-end", id: "text-1" },
            { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
          ],
        }),
      },
    ],
  });
  const tools = createChatTools(input.plotId, undefined, {
    resolve: async () => plot,
    layer: async (_id, layer) => layerResult(layer, {}),
  });
  const reply = await streamReply(ChatRequest.parse(input), tools, request(), mock);
  assert.equal(reply.status, 200);
  assert.match(reply.headers.get("Content-Type")!, /text\/event-stream/);
  const text = await reply.text();
  assert.match(text, /tool-output-available/);
  assert.match(text, /La superficie geometrica/);
  assert.match(text, /\[DONE\]/);
  assert.equal(mock.doStreamCalls.length, 2);
  assert.equal(mock.doStreamCalls[0].toolChoice?.type, "tool");
  assert.ok(mock.doStreamCalls[1].prompt.some((m) => m.role === "tool"));
});

test("rate limit keys on the platform address, not on a client-supplied forwarded-for", async () => {
  const { clientAddress } = await import("#server/chat/rate-limit.ts");
  const spoofed = new Request("http://x", { headers: { "x-forwarded-for": "6.6.6.6, 10.0.0.1" } });
  assert.equal(clientAddress(spoofed), "10.0.0.1");
  const vercel = new Request("http://x", {
    headers: { "x-real-ip": "1.2.3.4", "x-forwarded-for": "6.6.6.6" },
  });
  assert.equal(clientAddress(vercel), "1.2.3.4");
  assert.equal(clientAddress(new Request("http://x")), "local");
});

test("a global cap stops rotating addresses from bypassing the per-client limit", () => {
  const now = 0;
  const limiter = new ChatRateLimiter(8, 60_000, () => now, 3);
  for (let i = 0; i < 3; i++)
    limiter.consume(new Request("http://x", { headers: { "x-real-ip": `1.1.1.${i}` } }));
  assert.throws(() => limiter.consume(new Request("http://x", { headers: { "x-real-ip": "9.9.9.9" } })));
});
