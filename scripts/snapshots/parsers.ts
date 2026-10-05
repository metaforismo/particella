import { parse } from "csv-parse/sync";
import { z } from "zod";

export function parseDpcCsv(csv: string): Record<string, string> {
  const rows: unknown[] = parse(csv, {
    bom: true,
    columns: true,
    delimiter: ";",
    skip_empty_lines: true,
    trim: true,
  });
  const Row = z.object({
    COD_ISTAT_COMUNE: z.string().regex(/^\d{4,6}$/),
    ZONA_SISMICA: z.string().regex(/^[1-4][0-9A-Za-z., -]*$/),
  });
  const zones: Record<string, string> = {};
  for (const raw of rows) {
    const row = Row.parse(raw);
    const key = row.COD_ISTAT_COMUNE.padStart(6, "0");
    if (zones[key] !== undefined) throw new Error(`Duplicate DPC municipality ${key}`);
    zones[key] = row.ZONA_SISMICA;
  }
  if (!rows.length) throw new Error("Empty DPC CSV");
  return zones;
}

export function parsePopulationCsv(csv: string): Record<string, number> {
  const rows: string[][] = parse(csv, { bom: true, delimiter: ";", skip_empty_lines: true, trim: true });
  const totals: Record<string, number> = {};
  for (const row of rows) {
    if (!/^\d{6}$/.test(row[0]) || row[2] !== "999") continue;
    const total = Number(row[5]);
    if (!Number.isSafeInteger(total) || total < 0 || totals[row[0]] !== undefined)
      throw new Error("Invalid/duplicate population total");
    totals[row[0]] = total;
  }
  if (!Object.keys(totals).length) throw new Error("No age=999 totals found");
  return totals;
}
