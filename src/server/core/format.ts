/** Human-readable quantities only. Keep machine coordinates, dates, plan codes and license versions verbatim. */
export function formatNumber(value: number, maximumFractionDigits = 1): string {
  if (!Number.isFinite(value)) throw new RangeError("Cannot format a non-finite quantity");
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits, useGrouping: "always" }).format(value);
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${formatNumber(meters)} m` : `${formatNumber(meters / 1000)} km`;
}

/** Decimal-dot quantities; Italian thousands groups are valid. Excludes URLs and semantic identifiers. */
export function decimalDotQuantities(text: string): string[] {
  const prose = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\b(?:ODbL|DUSAF|CC BY(?:-SA)?)\s+\d+\.\d+\b/g, "");
  return [...prose.matchAll(/(?<![\w.,])\d+(?:\.\d+)+(?![\w.,])/g)]
    .map(([token]) => token)
    .filter((token) => !/^\d{1,3}(?:\.\d{3})+$/.test(token));
}
