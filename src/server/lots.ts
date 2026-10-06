import { z } from "zod";
import union from "@turf/union";
import { feature, featureCollection } from "@turf/helpers";
import { LotInput, Plot as PlotSchema, type Plot } from "#contracts";
import { parsePlotId } from "#server/countries/it/cadastre.ts";
import { BadRequest, UpstreamError } from "#server/core/errors.ts";
import { measurements, representativePoint, type PlotGeometry } from "#server/geo/index.ts";

export function parseLotId(id: string): string[] {
  const ids = id.split("+");
  if (ids.length > 20) throw new BadRequest("Un lotto può contenere al massimo 20 particelle.");
  const parts = ids.map(parsePlotId);
  if (new Set(ids).size !== ids.length) throw new BadRequest("Una particella è ripetuta nel lotto.");
  if (new Set(parts.map((p) => p.municipalityCode)).size !== 1)
    throw new BadRequest("Le particelle del lotto devono appartenere allo stesso Comune catastale.");
  return ids;
}

export const LotId = z
  .string()
  .max(2000)
  .superRefine((id, ctx) => {
    try {
      parseLotId(id);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Identificativo lotto non valido.",
      });
    }
  });

export function aggregatePlots(input: Plot[]): Plot {
  const plots = [...input].sort((a, b) => a.id.localeCompare(b.id));
  const id = plots.map((p) => p.id).join("+");
  parseLotId(id);
  if (plots.length < 2) throw new BadRequest("Selezionare almeno due particelle per un lotto composto.");
  if (plots.some((p) => !p.geometry || p.parcels))
    throw new BadRequest("Il lotto deve contenere particelle singole con geometria.");
  const municipalityCodes = new Set(plots.map((p) => p.municipality?.istatCode).filter(Boolean));
  if (municipalityCodes.size > 1) throw new BadRequest("Le particelle appartengono a Comuni ISTAT diversi.");
  let merged: ReturnType<typeof union>;
  try {
    merged = union(featureCollection(plots.map((p) => feature(p.geometry as PlotGeometry))));
  } catch {
    throw new UpstreamError("Impossibile unire le geometrie catastali del lotto.");
  }
  if (!merged) throw new UpstreamError("Impossibile unire le geometrie del lotto.");
  const geometry: PlotGeometry =
    merged.geometry.type === "MultiPolygon"
      ? merged.geometry
      : { type: "MultiPolygon", coordinates: [merged.geometry.coordinates] };
  const groups = new Map<string, string[]>();
  for (const p of plots) {
    const sheet = `${p.cadastral.section ? `Sezione ${p.cadastral.section} · ` : ""}Foglio ${p.cadastral.sheet}`;
    groups.set(sheet, [...(groups.get(sheet) ?? []), p.cadastral.parcel]);
  }
  const label = [...groups]
    .map(([sheet, parcels]) => `${sheet} · Particelle ${parcels.join(", ")}`)
    .join("; ");
  return PlotSchema.parse({
    ...plots[0],
    id,
    geometry,
    centroid: representativePoint(geometry),
    ...measurements(geometry),
    address: null,
    // Legacy scalar fields remain strings. Complete identifiers live in parcels[].
    cadastral: {
      ...plots[0].cadastral,
      sheet: [...new Set(plots.map((p) => p.cadastral.sheet))].join(", "),
      parcel: plots.map((p) => p.cadastral.parcel).join(", "),
      section: new Set(plots.map((p) => p.cadastral.section)).size === 1 ? plots[0].cadastral.section : null,
      label,
    },
    parcels: plots.map((p) => ({
      id: p.id,
      at: representativePoint(p.geometry as PlotGeometry),
      cadastral: p.cadastral,
    })),
    representativePointMethod: "interior-point",
    provenance: [
      ...new Map(plots.flatMap((p) => p.provenance).map((p) => [JSON.stringify(p), p])).values(),
      {
        sourceId: "particella-lot",
        dataset: "Unione geometrica delle particelle catastali",
        authority: "Particella",
        license: "CC BY 4.0 (geometrie AdE)",
        url: "https://github.com/metaforismo/particella",
        method: "computed",
        isOfficial: false,
        retrievedAt: new Date().toISOString(),
      },
    ],
  });
}

export async function createLot(
  input: unknown,
  resolve: (id: string, at?: { lat: number; lon: number }) => Promise<Plot>,
): Promise<Plot> {
  const parsed = LotInput.safeParse(input);
  if (!parsed.success)
    throw new BadRequest("Un lotto richiede da 2 a 20 particelle singole con ID e coordinate valide.");
  const { parcels } = parsed.data;
  parseLotId(parcels.map((p) => p.id).join("+"));
  const plots: Plot[] = [];
  // Sequential requests respect the cadastral source's concurrency and bound cold work.
  for (const parcel of parcels) plots.push(await resolve(parcel.id, parcel.at));
  return aggregatePlots(plots);
}
