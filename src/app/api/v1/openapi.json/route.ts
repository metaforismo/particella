import { OpenApiDocument, openApiDocument } from "#server/http/openapi.ts";
import { route, jsonResponse } from "#server/http/responses.ts";

export async function GET(request: Request) {
  return route(() => jsonResponse(OpenApiDocument, openApiDocument(), 86400), request);
}
export const runtime = "nodejs";
export const maxDuration = 60;
