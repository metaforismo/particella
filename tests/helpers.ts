import { readFileSync } from "node:fs";
import type { HttpPayload } from "../src/server/core/http.ts";
export const fixtureText = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
export const fixtureJson = (name: string): unknown => JSON.parse(fixtureText(name));
export const payload = (name: string): HttpPayload => ({ bytes: new TextEncoder().encode(fixtureText(name)), requestUrl: `https://example.test/${name}`, retrievedAt: "2026-10-05T21:00:00.000Z", contentType: name.endsWith("xml") ? "application/xml" : "application/json" });
