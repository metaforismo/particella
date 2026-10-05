import { z } from "zod";
import type { LayerProvider } from "../../../core/layers.ts";
import { layerResult } from "../../../core/layers.ts";
import { provenance } from "../../../core/provenance.ts";
import { jsonBody } from "../../../core/http.ts";
import { UpstreamError } from "../../../core/errors.ts";
import { fetchSource } from "../queries.ts";

const SolarResponse = z.object({
  inputs: z.object({
    meteo_data: z.object({
      radiation_db: z.string(),
      year_min: z.number(),
      year_max: z.number(),
      use_horizon: z.boolean(),
    }),
    mounting_system: z.object({
      fixed: z.object({ slope: z.object({ value: z.number() }), azimuth: z.object({ value: z.number() }) }),
    }),
  }),
  outputs: z.object({
    totals: z.object({
      fixed: z.object({ E_y: z.number().nonnegative(), "H(i)_y": z.number().nonnegative() }),
    }),
  }),
});
export function parseSolar(value: unknown) {
  const result = SolarResponse.safeParse(value);
  if (!result.success) throw new UpstreamError("Risposta PVGIS non valida.");
  return result.data;
}
export const solar: LayerProvider = async (plot, { signal }) => {
  const payload = await fetchSource(
    "pvgis",
    {
      lat: plot.centroid.lat,
      lon: plot.centroid.lon,
      peakpower: 1,
      loss: 14,
      optimalangles: 1,
      pvtechchoice: "crystSi",
      mountingplace: "free",
      usehorizon: 1,
      outputformat: "json",
    },
    { signal, timeoutMs: 22_000, ttlMs: 7_776_000_000 },
  );
  const data = parseSolar(jsonBody(payload));
  const totals = data.outputs.totals.fixed,
    meteo = data.inputs.meteo_data,
    mount = data.inputs.mounting_system.fixed;
  return layerResult("solar", {
    scope: "point",
    headline: `PVGIS stima circa ${Math.round(totals.E_y)} kWh all'anno per un impianto ideale da 1 kWp.`,
    severity: "none",
    metrics: [
      {
        key: "irradiation_annual",
        label: "Irraggiamento annuo sul piano ottimale",
        value: totals["H(i)_y"],
        unit: "kWh/m²/anno",
      },
      { key: "pv_annual", label: "Produzione annua stimata di 1 kWp", value: totals.E_y, unit: "kWh/anno" },
      { key: "optimal_slope", label: "Inclinazione ottimale", value: mount.slope.value, unit: "°" },
      { key: "optimal_azimuth", label: "Azimut ottimale (0° sud)", value: mount.azimuth.value, unit: "°" },
    ],
    legend: [{ classKey: "optimal-pv", label: "Simulazione PVGIS a orientamento ottimale" }],
    notes: [
      `PVGIS 5.3, database ${meteo.radiation_db}, anni ${meteo.year_min}–${meteo.year_max}; 1 kWp silicio cristallino, montaggio libero, perdite 14%, inclinazione e azimut ottimali.`,
      `Orizzonte DEM ${meteo.use_horizon ? "attivo" : "non attivo"}; ombre di edifici e alberi vicini non simulate. La produzione è climatologica, non una garanzia o un'autorizzazione all'impianto.`,
    ],
    provenance: [
      provenance("pvgis", payload, {
        dataset: `PVGIS 5.3 ${meteo.radiation_db}`,
        referenceDate: `${meteo.year_min}–${meteo.year_max}`,
      }),
    ],
  });
};
