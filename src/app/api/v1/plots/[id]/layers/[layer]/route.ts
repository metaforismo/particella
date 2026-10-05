import { route, jsonResponse, query } from "#server/http/responses.ts";
import { LayerId, LayerResult } from "#contracts";
import { getPlotLayer, plotQuery } from "#server/plots.ts";

export async function GET(request: Request, context: RouteContext<"/api/v1/plots/[id]/layers/[layer]">) {
  return route(async () => {
    const { id, layer: rawLayer } = await context.params;
    const { at } = query(request, plotQuery);
    const result = await getPlotLayer(id, LayerId.parse(rawLayer), at);
    return jsonResponse(
      LayerResult,
      result,
      ["unavailable", "partial", "error"].includes(result.status) ? 0 : 3600,
    );
  });
}

export const runtime = "nodejs";

export const maxDuration = 60;
