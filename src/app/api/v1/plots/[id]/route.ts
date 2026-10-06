import { route, jsonResponse, query } from "#server/http/responses.ts";
import { Plot } from "#contracts";
import { resolvePlot, plotQuery } from "#server/plots.ts";

export async function GET(request: Request, context: RouteContext<"/api/v1/plots/[id]">) {
  return route(async () => {
    const { id } = await context.params;
    const { at } = query(request, plotQuery);
    return jsonResponse(Plot, await resolvePlot(id, at), 3600);
  });
}

export const runtime = "nodejs";

export const maxDuration = 300;
