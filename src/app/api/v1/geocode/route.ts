import { route, jsonResponse, query } from "#server/http/responses.ts";
import { z } from "zod";
import { GeocodeResult } from "#contracts";
import { getCountry } from "#server/countries/index.ts";

export async function GET(request: Request) {
  return route(async () => {
    const input = query(
      request,
      z.object({ q: z.string().trim().min(3).max(200), country: z.literal("it").default("it") }).strict(),
    );
    return jsonResponse(z.array(GeocodeResult), await getCountry(input.country).geocode(input.q), 3600);
  });
}

export const runtime = "nodejs";

export const maxDuration = 60;
