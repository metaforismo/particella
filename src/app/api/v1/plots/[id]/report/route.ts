import { route, jsonResponse } from "../../../../../../server/http/responses.ts";
import { PlotReport, type LayerId } from "../../../../../../lib/contracts/index.ts";
import { getCountry } from "../../../../../../server/countries/index.ts";
import { runLayer, layerCatalog } from "../../../../../../server/core/layers.ts";
export async function GET(_request: Request, context: RouteContext<"/api/v1/plots/[id]/report">) {
  return route(async () => {
    const { id } = await context.params,
      country = getCountry("it");
    const plot = await country.plotById(id, AbortSignal.timeout(25_000));
    const layers = await Promise.all(
      layerCatalog.map(({ id: layer }) => runLayer(layer as LayerId, plot, country.layers[layer])),
    );
    const partial = layers.some((l) => ["unavailable", "partial", "error"].includes(l.status));
    return jsonResponse(
      PlotReport,
      { plot, layers, generatedAt: new Date().toISOString() },
      partial ? 0 : 300,
    );
  });
}
export const runtime = "nodejs";
export const maxDuration = 60;
