import { z } from "zod";
import type { LatLon } from "#contracts";
import { http, jsonBody, type HttpPayload, type HttpOptions } from "#server/core/http.ts";
import { source } from "#server/core/sources.ts";
import { UpstreamError } from "#server/core/errors.ts";
import { pointBox } from "#server/geo/index.ts";

export function queryUrl(base: string, params: Record<string, string | number | boolean>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return url.toString();
}

export async function fetchSource(
  id: string,
  params: Record<string, string | number | boolean>,
  options: HttpOptions = {},
): Promise<HttpPayload> {
  const s = source(id);
  return http.request(queryUrl(s.endpoint, params), { policy: s.hostPolicy, ...options, sourceId: s.id });
}

export const ArcResponse = z.object({
  features: z.array(
    z.object({ attributes: z.record(z.string(), z.unknown()), geometry: z.unknown().optional() }),
  ),
  exceededTransferLimit: z.boolean().optional(),
});

export function parseArc(payload: HttpPayload): z.infer<typeof ArcResponse> {
  const parsed = ArcResponse.safeParse(jsonBody(payload));
  if (!parsed.success) throw new UpstreamError("Risposta ArcGIS non valida o errore della fonte.");
  if (parsed.data.exceededTransferLimit)
    throw new UpstreamError("Risposta ArcGIS troncata: analisi incompleta.");
  return parsed.data;
}

export function arcPointParams(p: LatLon): Record<string, string | number | boolean> {
  return {
    f: "json",
    geometry: `${p.lon},${p.lat}`,
    geometryType: "esriGeometryPoint",
    inSR: 4326,
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: false,
  };
}

export function wmsPointParams(
  layer: string,
  p: LatLon,
  delta = 0.0001,
): Record<string, string | number | boolean> {
  return {
    service: "WMS",
    version: "1.1.1",
    request: "GetFeatureInfo",
    layers: layer,
    query_layers: layer,
    info_format: "application/json",
    srs: "EPSG:4326",
    bbox: pointBox(p, delta).join(","),
    width: 101,
    height: 101,
    x: 50,
    y: 50,
    feature_count: 100,
    format: "image/png",
    styles: "",
  };
}

const Geometry = z.union([
  z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(z.array(z.number()))).min(1) }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(z.array(z.array(z.array(z.number())))).min(1),
  }),
  z.object({ type: z.literal("Point"), coordinates: z.tuple([z.number(), z.number()]) }),
  z.object({ type: z.literal("LineString"), coordinates: z.array(z.array(z.number())) }),
]);

export const GeoCollection = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(
    z.object({
      type: z.literal("Feature"),
      id: z.union([z.number(), z.string()]).optional(),
      geometry: Geometry.nullable(),
      properties: z.record(z.string(), z.unknown()),
    }),
  ),
  numberReturned: z.number().optional(),
  totalFeatures: z.union([z.number(), z.string()]).optional(),
});

export function parseGeo(payload: HttpPayload): z.infer<typeof GeoCollection> {
  const parsed = GeoCollection.safeParse(jsonBody(payload));
  if (!parsed.success) throw new UpstreamError("GeoJSON della fonte non valido.");
  if (
    parsed.data.features.length >= 100 ||
    (typeof parsed.data.totalFeatures === "number" && parsed.data.totalFeatures > parsed.data.features.length)
  )
    throw new UpstreamError("Identificazione troncata dalla fonte.");
  return parsed.data;
}
