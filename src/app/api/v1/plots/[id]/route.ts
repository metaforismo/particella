import { route, jsonResponse } from "../../../../../server/http/responses.ts";
import { Plot } from "../../../../../lib/contracts/index.ts";
import { getCountry } from "../../../../../server/countries/index.ts";
export async function GET(_request: Request, context: RouteContext<"/api/v1/plots/[id]">) {
  return route(async () => {
    const { id } = await context.params;
    return jsonResponse(Plot, await getCountry("it").plotById(id), 3600);
  });
}
export const runtime = "nodejs";
export const maxDuration = 60;
