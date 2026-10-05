import { route } from "../../../../../../../../server/http/responses.ts";
import { TileParams, PngTile, tile } from "../../../../../../../../server/countries/it/tiles.ts";
import { validated } from "../../../../../../../../server/http/responses.ts";
export async function GET(_request: Request, context: RouteContext<"/api/v1/tiles/[overlay]/[z]/[x]/[y]">) {
  return route(async () => {
    const params = TileParams.parse(await context.params);
    const bytes = validated(PngTile, await tile(params));
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=604800, s-maxage=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
export const runtime = "nodejs";
export const maxDuration = 60;
