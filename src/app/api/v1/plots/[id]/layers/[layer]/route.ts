import { ServerTiming } from "#server/core/timing.ts";
import { route, jsonResponse, query } from "#server/http/responses.ts";
import { LayerId, LayerResult } from "#contracts";
import { getPlotLayer, plotQuery } from "#server/plots.ts";

export async function GET(request: Request, context: RouteContext<"/api/v1/plots/[id]/layers/[layer]">) {
  const timing = new ServerTiming();
  const response = await timing.measure("total", () =>
    route(async () => {
      const { id, layer: rawLayer } = await context.params;
      const { at } = query(request, plotQuery);
      const result = await getPlotLayer(id, LayerId.parse(rawLayer), at, timing);
      return jsonResponse(
        LayerResult,
        result,
        ["unavailable", "partial", "error"].includes(result.status) ? 0 : 3600,
      );
    }, request),
  );
  response.headers.set("Server-Timing", timing.header());
  return response;
}

export const runtime = "nodejs";

export const maxDuration = 300;
