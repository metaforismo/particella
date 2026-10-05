import { route, jsonResponse } from "../../../../../../../server/http/responses.ts";
import { LayerId, LayerResult } from "../../../../../../../lib/contracts/index.ts";
import { getCountry } from "../../../../../../../server/countries/index.ts";
import { runLayer } from "../../../../../../../server/core/layers.ts";
export async function GET(_request: Request, context: RouteContext<"/api/v1/plots/[id]/layers/[layer]">) {
  return route(async () => {
    const { id, layer: rawLayer } = await context.params;
    const layer = LayerId.parse(rawLayer), country = getCountry("it");
    const plot = await country.plotById(id);
    const result = await runLayer(layer, plot, country.layers[layer]);
    return jsonResponse(LayerResult, result, ["unavailable", "partial", "error"].includes(result.status) ? 0 : 3600);
  });
}
export const runtime = "nodejs";
export const maxDuration = 60;
