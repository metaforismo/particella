import { route, jsonResponse } from "#server/http/responses.ts";
import { Plot } from "#contracts";
import { getCountry } from "#server/countries/index.ts";
import { query, coordinateQuery } from "#server/http/responses.ts";

export async function GET(request: Request) {
  return route(async () => {
    const { lat, lon, country } = query(request, coordinateQuery());
    return jsonResponse(Plot, await getCountry(country).plotAt(lat, lon), 3600);
  }, request);
}

export const runtime = "nodejs";

export const maxDuration = 300;
