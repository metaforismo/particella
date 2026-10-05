import type { LayerId, Severity } from "@/lib/contracts";

/** Map colours per layer tone; same families as the legend swatches. */
const TONE: Record<string, string> = {
  sepia: "#8b5e34",
  hydro: "#2d6a96",
  verde: "#4f7a4a",
  ink: "#17201d",
  cantiere: "#c99a00",
};

export const SEVERITY_COLOR: Record<Severity, string> = {
  none: "#5c7a5a",
  low: "#7c7a2e",
  medium: "#a5651a",
  high: "#a8352a",
  unknown: "#6f7a74",
};

/**
 * Per-class colours where a layer has an established convention (hazard ramps, POI kinds).
 * Unknown classes fall back to the layer tone so new backend classes still render.
 */
const CLASS_COLOR: Partial<Record<LayerId, Record<string, string>>> = {
  flood: { P1: "#9fc0d8", P2: "#4f84aa", P3: "#1f4f74" },
  landslide: { P1: "#e2cfa0", P2: "#c9a35f", P3: "#a5651a", P4: "#a8352a", AA: "#6f7a74" },
  services: {
    school: "#2d6a96",
    transit: "#17201d",
    health: "#a8352a",
    shop: "#a5651a",
    park: "#4f7a4a",
  },
};

export function featureColorExpression(layer: LayerId, tone: string) {
  const classes = CLASS_COLOR[layer];
  const fallback = TONE[tone] ?? TONE.ink;
  if (!classes) return fallback;
  return ["match", ["get", "classKey"], ...Object.entries(classes).flat(), fallback] as unknown as string;
}

export function classColor(layer: LayerId, classKey: string, tone: string) {
  return CLASS_COLOR[layer]?.[classKey] ?? TONE[tone] ?? TONE.ink;
}
