import { formatNumber } from "#server/core/format.ts";
import { z } from "zod";
import type { LayerProvider } from "#server/core/layers.ts";
import { layerResult } from "#server/core/layers.ts";
import { provenance } from "#server/core/provenance.ts";
import { jsonBody } from "#server/core/http.ts";
import { UpstreamError } from "#server/core/errors.ts";
import { fetchSource } from "#server/countries/it/queries.ts";

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
  const totals = data.outputs.totals.fixed;
  const meteo = data.inputs.meteo_data;
  const mount = data.inputs.mounting_system.fixed;
  return layerResult("solar", {
    scope: "point",
    headline: `PVGIS stima circa ${formatNumber(totals.E_y, 0)} kWh all'anno per un impianto ideale da 1 kWp.`,
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
    method: `PVGIS 5.3 ${meteo.radiation_db}, anni ${meteo.year_min}–${meteo.year_max}; 1 kWp silicio cristallino, montaggio libero, perdite 14%, inclinazione/azimut ottimali; orizzonte DEM ${meteo.use_horizon ? "attivo" : "non attivo"}.`,
    notes: [
      "La stima usa il clima degli anni passati e un impianto ideale. Non garantisce la produzione reale.",
      "Le ombre di edifici e alberi vicini non sono considerate. Verificare i permessi per installare l’impianto.",
    ],
    provenance: [
      provenance("pvgis", payload, {
        dataset: `PVGIS 5.3 ${meteo.radiation_db}`,
        referenceDate: `${meteo.year_min}–${meteo.year_max}`,
      }),
    ],
  });
};
