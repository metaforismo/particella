import { z } from "zod";
import population from "../../../../../data/snapshots/it-population-2026-01.json" with { type: "json" };
import type { LayerProvider } from "../../../core/layers.ts";
import { layerResult } from "../../../core/layers.ts";
import { provenance } from "../../../core/provenance.ts";
import { UpstreamError } from "../../../core/errors.ts";
import { arcPointParams, fetchSource, parseArc } from "../queries.ts";

const Grid = z.object({ GRD_ID: z.string(), TOT_P_2021: z.number().int().nonnegative() });
export const demographics: LayerProvider = async (plot, { signal }) => {
  const payload = await fetchSource("istat-grid", arcPointParams(plot.centroid), { signal });
  const features = parseArc(payload).features;
  if (features.length > 1) throw new UpstreamError("Il punto ricade sul bordo tra più celle ISTAT: risultato ambiguo.");
  const cell = features.length ? Grid.safeParse(features[0].attributes) : null;
  if (cell && !cell.success) throw new UpstreamError("Attributi della griglia ISTAT non validi.");
  const grid = cell?.success ? cell.data : null;
  const commune = (population.rows as Record<string, { population: number; sourceUrl: string }>)[plot.municipality?.istatCode ?? ""];
  return layerResult("demographics", { status: grid ? "ok" : "empty", scope: "grid_cell", headline: grid ? `Nel 2021 la cella di un chilometro quadrato contava ${grid.TOT_P_2021} residenti.` : "La griglia censuaria non restituisce una cella per questo punto.", severity: "none", metrics: [{ key: "grid_population", label: "Residenti nella cella nel 2021", value: grid?.TOT_P_2021 ?? null, unit: "residenti" }, { key: "grid_id", label: "Identificativo della cella", value: grid?.GRD_ID ?? null }, { key: "municipality_population", label: "Residenti nel comune, stima 1 gennaio 2026", value: commune?.population ?? null, unit: "residenti", hint: "Scala comunale distinta dalla cella e dal lotto; stima provvisoria ISTAT." }], legend: [{ classKey: "census-grid-2021", label: "Cella censuaria 1 km², 2021" }], notes: ["Popolazione della cella europea EPSG:3035, non abitanti del lotto o dell'edificio. Query puntuale sul centro rappresentativo del lotto, nessuna ripartizione areale.", ...(!commune ? ["La popolazione comunale non è presente nello snapshot delle province importate."] : ["Il dato comunale è una stima al 1 gennaio 2026 e può essere revisionato."])], provenance: [provenance("istat-grid", payload), ...(commune ? [provenance("istat-population", { requestUrl: commune.sourceUrl, retrievedAt: population.retrievedAt })] : [])] });
};
