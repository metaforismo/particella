import { route, jsonResponse } from "#server/http/responses.ts";
import { z } from "zod";
import { SourceCatalogEntry } from "#contracts";
import { sourceCatalog } from "#server/core/sources.ts";

export async function GET(request: Request) {
  return route(() => jsonResponse(z.array(SourceCatalogEntry), sourceCatalog(), 86400), request);
}

export const runtime = "nodejs";

export const maxDuration = 60;
