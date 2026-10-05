const numberFormats = new Map<number, Intl.NumberFormat>();
const dateTime = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });

export function formatNumber(value: number, digits = 1) {
  let format = numberFormats.get(digits);
  if (!format) {
    format = new Intl.NumberFormat("it-IT", { maximumFractionDigits: digits });
    numberFormats.set(digits, format);
  }
  return format.format(value);
}

/** Square metres under one hectare, hectares above, the way surveyors write it. */
export function formatArea(m2: number | null) {
  if (m2 == null) return "—";
  if (m2 >= 10_000) return `${formatNumber(m2 / 10_000, 2)} ha`;
  return `${formatNumber(m2, 0)} m²`;
}

export function formatLength(m: number | null) {
  if (m == null) return "—";
  return m >= 1000 ? `${formatNumber(m / 1000, 2)} km` : `${formatNumber(m, 0)} m`;
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateTime.format(d);
}

export function formatMetric(value: number | string | null, unit?: string | null) {
  if (value == null) return "—";
  const text = typeof value === "number" ? formatNumber(value, Math.abs(value) >= 100 ? 0 : 1) : value;
  return unit ? `${text} ${unit}` : text;
}
