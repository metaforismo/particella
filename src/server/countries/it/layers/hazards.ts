import type { Severity } from "../../../../lib/contracts/index.ts";
export const identifyNote =
  "GetFeatureInfo WMS sul punto rappresentativo interno del lotto (pixel 101×101, bbox ±0,0001°): screening puntuale, senza verifica dell'intero poligono catastale. La geometria restituita è del dataset originale.";
export function severityForHazard(classes: string[]): Severity {
  if (classes.some((c) => c === "P3" || c === "P4")) return "high";
  if (classes.includes("P2")) return "medium";
  if (classes.includes("P1")) return "low";
  return "unknown";
}
export function landslideClass(properties: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(properties)) {
    if (/pericol|classe|pai|scenari/i.test(key)) {
      const match = String(value)
        .toUpperCase()
        .match(/\b(P[1-4]|AA)\b/);
      if (match) return match[1];
    }
  }
  return null;
}
