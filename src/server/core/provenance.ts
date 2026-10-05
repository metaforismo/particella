import type { Provenance } from "../../lib/contracts/index.ts";
import { source } from "./sources.ts";
import type { HttpPayload } from "./http.ts";

export function safeRequestUrl(input: string | null): string | null {
  if (!input) return null;
  const url = new URL(input);
  url.username = "";
  url.password = "";
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/token|key|secret|password|auth|credential|signature/i.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}
export function provenance(
  id: string,
  payload?: Pick<HttpPayload, "requestUrl" | "retrievedAt">,
  options: Partial<Pick<Provenance, "dataset" | "referenceDate" | "method">> = {},
): Provenance {
  const s = source(id);
  return {
    sourceId: id,
    dataset: s.name,
    authority: s.authority,
    license: s.license,
    url: s.url,
    method:
      s.protocol === "WFS"
        ? "wfs"
        : s.protocol === "WMS"
          ? "wms"
          : s.protocol === "snapshot"
            ? "snapshot"
            : "api",
    isOfficial: s.isOfficial,
    requestUrl: safeRequestUrl(payload?.requestUrl ?? null),
    retrievedAt: payload?.retrievedAt ?? new Date().toISOString(),
    referenceDate: s.referenceDate ?? null,
    ...options,
  };
}
