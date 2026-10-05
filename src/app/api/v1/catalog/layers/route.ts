import { route, jsonResponse } from "../../../../../server/http/responses.ts";
import { z } from "zod";
import { LayerCatalogEntry } from "../../../../../lib/contracts/index.ts";
import { layerCatalog } from "../../../../../server/core/layers.ts";
export async function GET() { return route(() => jsonResponse(z.array(LayerCatalogEntry), layerCatalog, 86400)); }
export const runtime = "nodejs";
export const maxDuration = 60;
