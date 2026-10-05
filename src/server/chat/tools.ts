import { tool } from "ai";
import { z } from "zod";
import { LayerId, type LayerResult, type Provenance } from "#contracts";
import { resolvePlot, getPlotLayer } from "#server/plots.ts";
import { source as sourceDefinition } from "#server/core/sources.ts";
import { layerCatalog } from "#server/core/layers.ts";

const sources = (provenance: Provenance[]) =>
  provenance.map(({ authority, dataset, license, referenceDate, retrievedAt, url }) => ({
    authority,
    dataset,
    license,
    referenceDate,
    retrievedAt,
    url,
  }));

export function compactLayer(result: LayerResult) {
  return {
    layer: result.layer,
    headline: result.headline,
    status: result.status,
    severity: result.severity,
    scope: result.scope,
    metrics: result.metrics,
    notes: result.notes,
    provenance: sources(result.provenance),
  };
}

export function createChatTools(
  plotId: string,
  at?: string,
  dependencies = { resolve: resolvePlot, layer: getPlotLayer },
) {
  let plot: ReturnType<typeof resolvePlot> | undefined;
  const getPlot = () => (plot ??= dependencies.resolve(plotId, at));
  return {
    getPlot: tool({
      description: "Leggi la particella selezionata e le sue fonti, prima di ogni risposta.",
      inputSchema: z.object({}).strict(),
      execute: async () => {
        const result = await getPlot();
        return {
          id: result.id,
          label: result.cadastral.label,
          municipality: result.municipality,
          areaM2: result.areaM2,
          perimeterM: result.perimeterM,
          scope: "parcel",
          provenance: sources(result.provenance),
        };
      },
    }),
    listLayers: tool({
      description: "Elenca i livelli consultabili e gli enti delle fonti.",
      inputSchema: z.object({}).strict(),
      execute: async () =>
        layerCatalog.map(({ id, title, sourceIds }) => ({
          layer: id,
          title,
          sources: sourceIds.map((id) => {
            const { authority, name, license, url, referenceDate } = sourceDefinition(id);
            return { authority, dataset: name, license, url, referenceDate };
          }),
        })),
    }),
    getLayer: tool({
      description:
        "Leggi i dati verificati di un livello sul terreno selezionato. Non assumere che un livello vuoto o fuori copertura escluda rischi.",
      inputSchema: z.object({ layer: LayerId }).strict(),
      execute: async ({ layer }) => {
        await getPlot();
        return compactLayer(await dependencies.layer(plotId, layer, at));
      },
    }),
  };
}
