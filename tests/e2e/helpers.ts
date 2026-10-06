import { readFileSync } from "node:fs";
import type { Page, Route } from "@playwright/test";

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

export const geocode = fixture("geocode-signoria.json");
export const plot = fixture("plot-bagno-a-ripoli.json");
export const layers: Record<string, unknown> = fixture("layers-bagno-a-ripoli.json");

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

/** Serve recorded API responses and keep third-party map tiles out of the test. */
export async function mockApi(page: Page, calls: string[] = []) {
  await page.route(/tiles\.openfreemap\.org|\/api\/v1\/tiles\//, (route) => route.abort());
  await page.route("**/api/v1/**", (route) => {
    const url = new URL(route.request().url());
    calls.push(url.pathname + url.search);
    if (url.pathname === "/api/v1/geocode") return json(route, geocode);
    if (url.pathname === "/api/v1/plots/at") return json(route, plot);
    const layer = url.pathname.match(/\/layers\/([a-z-]+)$/)?.[1];
    if (layer)
      return layers[layer]
        ? json(route, layers[layer])
        : json(route, { error: { code: "not_found", message: "x" } }, 404);
    if (url.pathname.startsWith("/api/v1/plots/")) return json(route, plot);
    return json(route, { error: { code: "not_found", message: "Non simulato nei test." } }, 404);
  });
  return calls;
}
