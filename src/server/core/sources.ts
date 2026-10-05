import type { SourceCatalogEntry } from "../../lib/contracts/index.ts";
import type { HostPolicy } from "./http.ts";
import { italianSources } from "../countries/it/sources.ts";

export interface SourceDefinition extends SourceCatalogEntry {
  isOfficial: boolean; licenseUrl: string; protocol: "REST" | "WMS" | "WFS" | "snapshot";
  endpoint: string; hostPolicy: HostPolicy; verification: { state: "verified" | "partial"; date: string; note: string };
  referenceDate?: string;
}
export const sources: readonly SourceDefinition[] = italianSources;
export function source(id: string): SourceDefinition {
  const found = sources.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown source ${id}`);
  return found;
}
export function sourceCatalog(): SourceCatalogEntry[] {
  return sources.map(({ id, name, authority, license, url, coverage, updateCadence }) => ({ id, name, authority, license, url, coverage, updateCadence }));
}
