import { formatLocation, type PlotLocation } from "@/lib/routes";

/** Up to four plots side by side: beyond that the table stops being readable on a laptop. */
export const COMPARE_LIMIT = 4;

/** Shareable link: each plot as `id@lat,lon`, so the page can re-resolve it on any server instance. */
export function compareHref(plots: readonly { id: string; at?: PlotLocation }[]) {
  const params = new URLSearchParams();
  for (const p of plots) params.append("p", p.at ? `${p.id}@${formatLocation(p.at)}` : p.id);
  return `/confronta?${params}`;
}
