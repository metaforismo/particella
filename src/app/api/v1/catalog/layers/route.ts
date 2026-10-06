import { route, jsonResponse } from "#server/http/responses.ts";
import { z } from "zod";
import { LayerCatalogEntry } from "#contracts";
import { layerCatalog } from "#server/core/layers.ts";

export async function GET(request: Request) {
  return route(() => jsonResponse(z.array(LayerCatalogEntry), layerCatalog, 86400), request);
}

export const runtime = "nodejs";

export const maxDuration = 60;
