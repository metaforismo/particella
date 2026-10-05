import type { SourceCatalogEntry } from "#contracts";
import type { HostPolicy } from "#server/core/http.ts";
import { countrySources } from "#server/countries/sources.ts";

export interface SourceVerification {
  state: "verified" | "partial";
  date: string;
  note: string;
}

export interface SourceDefinition extends SourceCatalogEntry {
  isOfficial: boolean;
  licenseUrl: string;
  protocol: "REST" | "WMS" | "WFS" | "snapshot";
  endpoint: string;
  hostPolicy: HostPolicy;
  verification: SourceVerification;
  referenceDate?: string;
}

export const sources: readonly SourceDefinition[] = countrySources;

export function source(id: string): SourceDefinition {
  const found = sources.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown source ${id}`);
  return found;
}

export function sourceCatalog(): SourceCatalogEntry[] {
  return sources.map(({ id, name, authority, license, url, coverage, updateCadence }) => ({
    id,
    name,
    authority,
    license,
    url,
    coverage,
    updateCadence,
  }));
}
