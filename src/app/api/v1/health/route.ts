import { route, jsonResponse } from "#server/http/responses.ts";
import { Health } from "#contracts";

export async function GET(request: Request) {
  return route(
    () => jsonResponse(Health, { status: "ok", version: "0.1", timestamp: new Date().toISOString() }),
    request,
  );
}

export const runtime = "nodejs";

export const maxDuration = 60;
