import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";
import { getCountry } from "#server/countries/index.ts";
import { getPlotLayer } from "#server/plots.ts";
import type { LayerId, LayerResult } from "#contracts";

// Inside the real parcel of Palazzo Vecchio, Florence; not a street or nearest match.
const point = { lat: 43.76927, lon: 11.2565 };

const plot = await getCountry("it").plotAt(point.lat, point.lon);

if (plot.geometry?.type !== "Polygon" || plot.areaM2 === null || !plot.municipality)
  throw Error("Hero requires a confirmed polygon parcel and municipality");

const metric = (result: LayerResult, key: string) =>
  result.metrics.find((metric) => metric.key === key)?.value;

const rows: { layer: LayerId; value: string; source: string }[] = [];

for (const layer of ["planning", "flood", "seismic", "solar"] as const) {
  const result = await getPlotLayer(plot.id, layer, `${point.lat.toFixed(6)},${point.lon.toFixed(6)}`);
  if (["unavailable", "error", "outside_coverage"].includes(result.status) || !result.provenance.length)
    throw Error(`${layer}: ${result.status}`);
  let value: string;
  let source = result.provenance[0].authority;
  if (layer === "planning") {
    const description = String(result.metrics[0]?.value ?? "");
    const zone = description.match(/zona ([A-Z]) - sottozona ([A-Z]\d+)/i);
    value = zone ? `Zona ${zone[1]} · sottozona ${zone[2]}` : description;
  } else if (layer === "flood") {
    const scenarios = metric(result, "scenarios");
    value = scenarios ? `Scenari ${scenarios}` : "Nessuna area restituita al punto";
    if (result.status === "partial") throw Error("Hero flood must include every scenario");
  } else if (layer === "seismic") {
    const zone = metric(result, "zone");
    if (zone === null || zone === undefined) throw Error("No seismic classification");
    value = `Zona sismica ${zone} (Comune)`;
    source = "Dipartimento della Protezione Civile";
  } else {
    const annual = metric(result, "pv_annual");
    if (typeof annual !== "number") throw Error("No solar yield");
    value = `~${Math.round(annual).toLocaleString("it-IT", { useGrouping: "always" })} kWh/anno per 1 kWp`;
  }
  if (!value || value.length > 40) throw Error(`Hero value exceeds 40 characters: ${layer}`);
  rows.push({ layer, value, source });
}

const artifact = {
  plot: {
    id: plot.id,
    label: plot.cadastral.label,
    municipality: plot.municipality.name,
    area: `${Math.round(plot.areaM2).toLocaleString("it-IT", { useGrouping: "always" })} m²`,
    geometry: plot.geometry,
  },
  rows,
  apiSample: {
    id: plot.id,
    country: plot.country,
    cadastral: plot.cadastral,
    municipality: plot.municipality,
    centroid: plot.centroid,
    areaM2: plot.areaM2,
    provenance: plot.provenance.map(({ authority, dataset, license, retrievedAt }) => ({
      authority,
      dataset,
      license,
      retrievedAt,
    })),
  },
};

const outputPath = fileURLToPath(new URL("../../src/content/hero-example.json", import.meta.url));

const formatted = await format(JSON.stringify(artifact), {
  ...(await resolveConfig(outputPath)),
  parser: "json",
});

await writeFile(outputPath, formatted);

console.log(JSON.stringify({ id: plot.id, point, rows }, null, 2));
