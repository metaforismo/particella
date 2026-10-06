import { route, validated } from "#server/http/responses.ts";
import { TileParams, PngTile, tile } from "#server/countries/it/tiles.ts";
import { configuredCounterStore, enforceTileUpstreamLimit } from "#server/http/rate-limit.ts";

const counters = configuredCounterStore();

export async function GET(request: Request, context: RouteContext<"/api/v1/tiles/[overlay]/[z]/[x]/[y]">) {
  return route(async () => {
    const params = TileParams.parse(await context.params);
    const bytes = validated(
      PngTile,
      await tile(params, request.signal, () => enforceTileUpstreamLimit(request, counters)),
    );
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=604800, s-maxage=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }, request);
}

export const runtime = "nodejs";

export const maxDuration = 60;
