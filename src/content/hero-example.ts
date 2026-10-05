import type { LayerId, Plot } from "@/lib/contracts";
import snapshot from "./hero-example.json";

export type HeroExample = {
  plot: {
    id: string;
    label: string;
    municipality: string;
    area: string;
    geometry: NonNullable<Plot["geometry"]>;
  };
  rows: { layer: LayerId; value: string; source: string }[];
};

/**
 * The landing hero shows one real plot. `hero-example.json` is produced by
 * `npm run content:hero`, which calls our own API, so the numbers are never invented.
 */
export const heroExample = snapshot as HeroExample;
