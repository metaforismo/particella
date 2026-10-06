import { Plot } from "#contracts";
import { createLot } from "#server/lots.ts";
import { resolvePlot } from "#server/plots.ts";
import { boundedJson } from "#server/http/body.ts";
import { route, jsonResponse } from "#server/http/responses.ts";

export async function POST(request: Request) {
  return route(async () => {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(240_000)]);
    return jsonResponse(
      Plot,
      await createLot(await boundedJson(request), (id, at) => resolvePlot(id, at, signal)),
      0,
    );
  });
}
export const runtime = "nodejs";
export const maxDuration = 300;
