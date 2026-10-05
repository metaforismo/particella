import { PNG } from "pngjs";
import { z } from "zod";
import type { HttpPayload } from "../../core/http.ts";
import { http } from "../../core/http.ts";
import { source } from "../../core/sources.ts";
import { NotFound, UpstreamError } from "../../core/errors.ts";
import { tileBbox } from "../../geo/index.ts";
import { queryUrl } from "./queries.ts";

export const TileParams = z
  .object({
    overlay: z.enum(["cadastre", "flood", "landslide"]),
    z: z
      .string()
      .regex(/^\d{1,2}$/)
      .transform(Number)
      .pipe(z.number().max(22)),
    x: z
      .string()
      .regex(/^\d{1,8}$/)
      .transform(Number),
    y: z
      .string()
      .regex(/^\d{1,8}$/)
      .transform(Number),
  })
  .refine((p) => p.x < 2 ** p.z && p.y < 2 ** p.z, "Coordinate tile fuori griglia");
export const PngTile = z.custom<Uint8Array>(
  (value) =>
    value instanceof Uint8Array &&
    value.length >= 24 &&
    Buffer.from(value.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    Buffer.from(value).readUInt32BE(16) === 256 &&
    Buffer.from(value).readUInt32BE(20) === 256,
  "Tile PNG 256×256 non valido",
);
const definitions = {
  cadastre: { sourceId: "ade-zoning", layers: "CP.CadastralParcel", minZoom: 12 },
  flood: {
    sourceId: "idrogeo",
    layers:
      "idrogeo:pericolosita_idraulica_p1,idrogeo:pericolosita_idraulica_p2,idrogeo:pericolosita_idraulica_p3",
    minZoom: 0,
  },
  landslide: { sourceId: "idrogeo", layers: "idrogeo:pericolosita_frane", minZoom: 0 },
} as const;
const latitude = (mercatorY: number) => (Math.atan(Math.sinh(mercatorY / 6378137)) * 180) / Math.PI;
export function cadastralTileRequest(z: number, x: number, y: number): string {
  const [west, south, east, north] = tileBbox(z, x, y);
  const lon = (value: number) => ((value / 6378137) * 180) / Math.PI;
  return queryUrl(source("ade-zoning").endpoint, {
    SERVICE: "WMS",
    VERSION: "1.3.0",
    REQUEST: "GetMap",
    LAYERS: definitions.cadastre.layers,
    STYLES: "",
    FORMAT: "image/png",
    TRANSPARENT: true,
    WIDTH: 256,
    HEIGHT: 256,
    CRS: "EPSG:6706",
    BBOX: [latitude(south), lon(west), latitude(north), lon(east)].join(","),
  });
}
// AdE cannot render EPSG:3857. Resample latitude rows to Mercator; x is linear in both CRSs.
export function reprojectCadastralTile(bytes: Uint8Array, z: number, x: number, y: number): Uint8Array {
  const input = PNG.sync.read(Buffer.from(bytes));
  if (input.width !== 256 || input.height !== 256) throw new UpstreamError("Dimensioni tile AdE inattese.");
  const output = new PNG({ width: 256, height: 256 });
  const [, south, , north] = tileBbox(z, x, y),
    top = latitude(north),
    bottom = latitude(south);
  for (let row = 0; row < 256; row++) {
    const lat = latitude(north - ((row + 0.5) / 256) * (north - south));
    const src = Math.max(0, Math.min(255, ((top - lat) / (top - bottom)) * 256 - 0.5));
    const low = Math.floor(src),
      high = Math.min(255, low + 1),
      weight = src - low;
    for (let col = 0; col < 256; col++)
      for (let channel = 0; channel < 4; channel++) {
        output.data[(row * 256 + col) * 4 + channel] = Math.round(
          input.data[(low * 256 + col) * 4 + channel] * (1 - weight) +
            input.data[(high * 256 + col) * 4 + channel] * weight,
        );
      }
  }
  return new Uint8Array(PNG.sync.write(output));
}
export async function tile(params: z.infer<typeof TileParams>, signal?: AbortSignal): Promise<Uint8Array> {
  const definition = definitions[params.overlay];
  if (!definition) throw new NotFound("Overlay non disponibile.");
  if (params.z < definition.minZoom)
    return new Uint8Array(PNG.sync.write(new PNG({ width: 256, height: 256 })));
  const s = source(definition.sourceId);
  const url =
    params.overlay === "cadastre"
      ? cadastralTileRequest(params.z, params.x, params.y)
      : queryUrl(s.endpoint, {
          SERVICE: "WMS",
          VERSION: "1.1.1",
          REQUEST: "GetMap",
          LAYERS: definition.layers,
          STYLES: "",
          FORMAT: "image/png",
          TRANSPARENT: true,
          WIDTH: 256,
          HEIGHT: 256,
          SRS: "EPSG:3857",
          BBOX: tileBbox(params.z, params.x, params.y).join(","),
        });
  const payload: HttpPayload = await http.request(url, { signal, policy: s.hostPolicy, ttlMs: 604_800_000 });
  if (!payload.contentType.toLowerCase().startsWith("image/png") || !PngTile.safeParse(payload.bytes).success)
    throw new UpstreamError("Il WMS non ha restituito un tile PNG valido.");
  return params.overlay === "cadastre"
    ? reprojectCadastralTile(payload.bytes, params.z, params.x, params.y)
    : payload.bytes;
}
