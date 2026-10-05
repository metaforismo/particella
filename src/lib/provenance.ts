import type { Provenance } from "@/lib/contracts";

/**
 * One entry per source and dataset, keeping the most recent reading. A layer may query the same
 * source several times (e.g. elevation at many points); readers need each source listed once.
 */
export function uniqueSources(entries: readonly Provenance[]): Provenance[] {
  const byKey = new Map<string, Provenance>();
  for (const entry of entries) {
    const key = `${entry.sourceId}|${entry.dataset}`;
    const seen = byKey.get(key);
    if (!seen || entry.retrievedAt > seen.retrievedAt) byKey.set(key, entry);
  }
  return [...byKey.values()];
}
