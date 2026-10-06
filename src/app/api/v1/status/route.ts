import { SourceStatusResponse, StatusQuery } from "#contracts";
import { sourceStatuses } from "#server/core/source-status.ts";
import { probeSources } from "#server/core/source-probe.ts";
import { jsonResponse, query, route } from "#server/http/responses.ts";

export async function GET(request: Request) {
  return route(async () => {
    const { probe } = query(request, StatusQuery);
    if (probe) await probeSources(request);
    return jsonResponse(SourceStatusResponse, await sourceStatuses(), probe ? 0 : 15);
  }, request);
}
export const runtime = "nodejs";
export const maxDuration = 120;
