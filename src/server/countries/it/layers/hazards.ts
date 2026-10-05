import type { Severity } from "#contracts";

export const identifyNote =
  "GetFeatureInfo WMS sul punto rappresentativo coperto dal lotto (pixel 101×101, bbox ±0,0001°): screening puntuale, senza verifica dell'intero poligono catastale. La geometria restituita è del dataset originale.";

export function severityForHazard(classes: string[]): Severity {
  if (classes.some((c) => c === "P3" || c === "P4")) return "high";
  if (classes.includes("P2")) return "medium";
  if (classes.includes("P1")) return "low";
  return "unknown";
}

export function landslideClass(properties: Record<string, unknown>): string | null {
  // Mapping published by ISPRA's WMS GetStyles for pericolosita_frane.
  const code = String(properties.cod_per_it ?? "");
  if (/^[0-4]$/.test(code)) return code === "0" ? "AA" : `P${code}`;
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
