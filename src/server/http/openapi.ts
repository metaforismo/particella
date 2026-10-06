import { z } from "zod";
import {
  ApiError,
  GeocodeQuery,
  GeocodeResponse,
  Health,
  LatLon,
  LayerCatalogEntry,
  LayerId,
  LayerResult,
  LotInput,
  Plot,
  PlotReport,
  SourceCatalogEntry,
  SourceStatusResponse,
  StatusQuery,
} from "#contracts";
import { ChatRequest } from "#lib/contracts/chat.ts";
import { coordinateQuery } from "#server/http/responses.ts";
import { plotQuery } from "#server/plots.ts";
import { TileParams } from "#server/countries/it/tiles.ts";

export const OpenApiDocument = z.object({
  openapi: z.literal("3.1.0"),
  info: z.object({ title: z.string(), version: z.string() }),
  paths: z.record(z.string(), z.unknown()),
  components: z.record(z.string(), z.unknown()),
});
const atDescription =
  "Punto interno lat,lon; per un lotto un punto per particella separato da ; nello stesso ordine degli ID. Il resolver verifica identità e appartenenza.";
const id = z
  .string()
  .min(1)
  .max(2000)
  .describe(
    "ID it:Belfiore:sezione|_:foglio:particella; + per un lotto di massimo 20 particelle dello stesso Comune, senza duplicati.",
  );
const Empty = z.object({}).strict();

/** Metadata is explicit; every JSON payload and parameter comes from its executable zod schema. */
export const apiOperations = [
  {
    path: "/api/v1/health",
    method: "get",
    summary: "Liveness senza richieste esterne",
    query: Empty,
    response: "Health",
  },
  {
    path: "/api/v1/geocode",
    method: "get",
    summary: "Ricerca testuale o catastale",
    query: GeocodeQuery,
    response: "GeocodeResponse",
  },
  {
    path: "/api/v1/catalog/layers",
    method: "get",
    summary: "Catalogo dei livelli",
    query: Empty,
    response: "LayerCatalog",
  },
  {
    path: "/api/v1/catalog/sources",
    method: "get",
    summary: "Catalogo delle fonti",
    query: Empty,
    response: "SourceCatalog",
  },
  {
    path: "/api/v1/plots/at",
    method: "get",
    summary: "Particella nel punto indicato",
    query: coordinateQuery(),
    response: "Plot",
  },
  {
    path: "/api/v1/plots/{id}",
    method: "get",
    summary: "Particella o lotto per ID",
    query: plotQuery,
    pathParams: z.object({ id }),
    response: "Plot",
  },
  {
    path: "/api/v1/plots/{id}/layers/{layer}",
    method: "get",
    summary: "Analisi di un livello",
    query: plotQuery,
    pathParams: z.object({ id, layer: LayerId }),
    response: "LayerResult",
  },
  {
    path: "/api/v1/plots/{id}/report",
    method: "get",
    summary: "Scheda completa",
    query: plotQuery,
    pathParams: z.object({ id }),
    response: "PlotReport",
  },
  {
    path: "/api/v1/lots",
    method: "post",
    summary: "Aggrega da 2 a 20 particelle",
    query: Empty,
    body: "LotInput",
    response: "Plot",
  },
  {
    path: "/api/v1/tiles/{overlay}/{z}/{x}/{y}",
    method: "get",
    summary: "Tile PNG 256×256; x e y < 2^z",
    query: Empty,
    pathParams: TileParams,
    response: "PngTile",
  },
  {
    path: "/api/v1/studio/chat",
    method: "post",
    summary: "Chiedi al terreno (AI SDK UI Message Stream)",
    query: Empty,
    body: "ChatRequest",
    response: "ChatStream",
  },
  {
    path: "/api/v1/status",
    method: "get",
    summary: "Ultime osservazioni HTTP; probe=1 richiede chiave admin separata",
    query: StatusQuery,
    response: "SourceStatusResponse",
  },
  {
    path: "/api/v1/openapi.json",
    method: "get",
    summary: "Specifica OpenAPI 3.1",
    query: Empty,
    response: "OpenApiDocument",
  },
] as const;
export const apiSchemas: Record<string, z.ZodType> = {
  ApiError,
  Health,
  GeocodeResponse,
  Plot,
  LayerResult,
  PlotReport,
  LotInput,
  LayerCatalog: z.array(LayerCatalogEntry),
  SourceCatalog: z.array(SourceCatalogEntry),
  SourceStatusResponse,
  ChatRequest,
  OpenApiDocument,
  LatLon,
  // Binary and SSE payloads have wire schemas; they are not JSON objects at runtime.
  PngTile: z.string().meta({ contentMediaType: "image/png" }),
  ChatStream: z
    .string()
    .describe(
      "SSE: data: <JSON UIMessageChunk> followed by a blank line; terminates with data: [DONE]. Errors after headers are stream events, not ApiError JSON.",
    ),
};
const examplePlot = {
  id: "it:D612:_:1:1",
  country: "it",
  cadastral: {
    municipalityCode: "D612",
    section: null,
    sheet: "1",
    parcel: "1",
    label: "Foglio 1 · Particella 1",
  },
  municipality: null,
  address: null,
  centroid: { lat: 43.77, lon: 11.25 },
  geometry: null,
  areaM2: null,
  perimeterM: null,
  provenance: [],
};
const exampleLayer = {
  layer: "terrain",
  group: "contesto",
  title: "Terreno",
  status: "outside_coverage",
  scope: "point",
  headline: "Dato non coperto nell’esempio.",
  severity: "unknown",
  metrics: [],
  features: null,
  overlays: [],
  legend: [],
  notes: [],
  provenance: [],
  computedAt: "2026-10-06T00:00:00Z",
};
export const apiExamples: Record<string, unknown> = {
  OpenApiDocument: {
    openapi: "3.1.0",
    info: { title: "Particella API", version: "0.1.0" },
    paths: {},
    components: {},
  },
  ApiError: { error: { code: "rate_limited", message: "Limite temporaneo di richieste raggiunto." } },
  Health: { status: "ok", version: "0.1", timestamp: "2026-10-06T00:00:00Z" },
  GeocodeResponse: [],
  Plot: examplePlot,
  LayerResult: exampleLayer,
  PlotReport: { plot: examplePlot, layers: [exampleLayer], generatedAt: "2026-10-06T00:00:00Z" },
  LotInput: { parcels: [{ id: "it:D612:_:1:1" }, { id: "it:D612:_:1:2" }] },
  LayerCatalog: [],
  SourceCatalog: [],
  SourceStatusResponse: [],
  ChatRequest: {
    id: "example",
    plotId: "it:D612:_:1:1",
    messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "Quali fonti sono disponibili?" }] }],
  },
  PngTile: "Binary PNG, 256 by 256 pixels",
  ChatStream: 'data: {"type":"start","messageId":"example"}\n\ndata: [DONE]\n\n',
  LatLon: { lat: 43.77, lon: 11.25 },
};
function jsonSchema(schema: z.ZodType, io: "input" | "output" = "output") {
  const { $schema, ...result } = z.toJSONSchema(schema, { target: "draft-2020-12", io });
  void $schema;
  return result;
}
function parameters(schema: z.ZodType, location: "query" | "path") {
  const converted = jsonSchema(schema, "input");
  return Object.entries(converted.properties ?? {}).map(([name, definition]) => ({
    name,
    in: location,
    required: location === "path" || converted.required?.includes(name) || false,
    schema: definition,
    ...(name === "at" ? { description: atDescription } : {}),
  }));
}
const timing = {
  description: "Durata totale e, nelle analisi, dei singoli livelli (millisecondi).",
  schema: { type: "string" },
  example: "total;dur=42.1",
};
const retry = {
  description: "Secondi prima di riprovare; presente con HTTP 429.",
  schema: { type: "string", pattern: "^[0-9]+$" },
  example: "30",
};
export function openApiDocument() {
  const schemas = Object.fromEntries(
    Object.entries(apiSchemas).map(([name, schema]) => [
      name,
      jsonSchema(schema, name === "LotInput" || name === "ChatRequest" ? "input" : "output"),
    ]),
  );
  const paths = Object.fromEntries(
    apiOperations.map((op) => {
      const media =
        op.response === "PngTile"
          ? "image/png"
          : op.response === "ChatStream"
            ? "text/event-stream"
            : "application/json";
      const responses: Record<string, unknown> = {
        "200": {
          description: "Risposta valida; dati mancanti e fuori copertura sono espliciti nel contratto.",
          headers: { "Server-Timing": timing },
          content: {
            [media]: {
              schema: { $ref: `#/components/schemas/${op.response}` },
              ...(op.response in apiExamples ? { example: apiExamples[op.response] } : {}),
            },
          },
        },
      };
      for (const [status, code] of Object.entries({
        400: "bad_request",
        401: "unauthorized",
        404: "not_found",
        429: "rate_limited",
        500: "internal",
        502: "upstream_unavailable",
        503: "not_configured",
      })) {
        if (status === "429" && op.path === "/api/v1/health") continue;
        if (status === "401" && op.path !== "/api/v1/status") continue;
        responses[status] = {
          description: code,
          headers: { "Server-Timing": timing, ...(status === "429" ? { "Retry-After": retry } : {}) },
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
              example: {
                error: {
                  code,
                  message:
                    code === "rate_limited"
                      ? "Limite temporaneo di richieste raggiunto."
                      : "Richiesta non completata.",
                },
              },
            },
          },
        };
      }
      return [
        op.path,
        {
          [op.method]: {
            operationId: `${op.method}_${op.path.replace(/[^a-z0-9]/gi, "_")}`,
            summary: op.summary,
            description:
              "Zod applica anche controlli semantici (identità catastale, appartenenza, conversazione) non esprimibili interamente in JSON Schema. Parametri di query duplicati non ammessi; quelli sconosciuti sono rifiutati nelle route con query validata.",
            security: op.path === "/api/v1/health" ? [] : [{}, { ApiKey: [] }],
            parameters: [
              ...parameters(op.query, "query"),
              ...("pathParams" in op ? parameters(op.pathParams, "path") : []),
            ],
            ...("body" in op
              ? {
                  requestBody: {
                    required: true,
                    content: {
                      "application/json": {
                        schema: { $ref: `#/components/schemas/${op.body}` },
                        example: apiExamples[op.body],
                      },
                    },
                  },
                }
              : {}),
            responses,
          },
        },
      ];
    }),
  );
  return OpenApiDocument.parse({
    openapi: "3.1.0",
    info: { title: "Particella API", version: "0.1.0" },
    paths,
    components: {
      schemas,
      securitySchemes: {
        ApiKey: {
          type: "http",
          scheme: "bearer",
          description:
            "Opzionale: chiave per limiti più alti. Per status?probe=1 serve la chiave amministrativa separata; il bearer pubblico non autorizza il probe.",
        },
      },
    },
  });
}
