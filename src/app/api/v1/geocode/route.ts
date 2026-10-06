import { route, jsonResponse, query } from "#server/http/responses.ts";
import { GeocodeResponse, GeocodeQuery } from "#contracts";
import { getCountry } from "#server/countries/index.ts";

export async function GET(request: Request) {
  return route(async () => {
    const input = query(request, GeocodeQuery);
    return jsonResponse(
      GeocodeResponse,
      distinctPlaces(await getCountry(input.country).geocode(input.q, request.signal)),
      3600,
    );
  }, request);
}

/** OSM often maps one square or street as several objects with the same name: show it once. */
function distinctPlaces(results: GeocodeResponse): GeocodeResponse {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.kind === "parcel" ? r.id : ""}|${r.label}|${r.secondary ?? ""}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const runtime = "nodejs";

export const maxDuration = 300;
