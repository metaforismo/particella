import { ServerTiming } from "#server/core/timing.ts";
import { route, jsonResponse, query } from "#server/http/responses.ts";
import { PlotReport } from "#contracts";
import { getPlotReport, plotQuery } from "#server/plots.ts";

export async function GET(request: Request, context: RouteContext<"/api/v1/plots/[id]/report">) {
  const timing = new ServerTiming();
  const response = await timing.measure("total", () =>
    route(async () => {
      const { id } = await context.params;
      const { at } = query(request, plotQuery);
      const result = await getPlotReport(id, at, timing);
      const partial = result.layers.some((l) => ["unavailable", "partial", "error"].includes(l.status));
      return jsonResponse(PlotReport, result, partial ? 0 : 300);
    }),
  );
  response.headers.set("Server-Timing", timing.header());
  return response;
}

export const runtime = "nodejs";

export const maxDuration = 60;
