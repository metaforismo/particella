import { route, jsonResponse } from "#server/http/responses.ts";
import { z } from "zod";
import { SourceCatalogEntry } from "#contracts";
import { sourceCatalog } from "#server/core/sources.ts";

export async function GET() {
  return route(() => jsonResponse(z.array(SourceCatalogEntry), sourceCatalog(), 86400));
}

export const runtime = "nodejs";

export const maxDuration = 60;
