import type { CountryAdapter } from "./types.ts";
import { NotConfigured } from "../core/errors.ts";
import { overlay } from "../core/layers.ts";
import { plotAt, plotById } from "./it/cadastre.ts";
import { geocode } from "./it/geocode.ts";
import { flood } from "./it/layers/flood.ts";
import { landslide } from "./it/layers/landslide.ts";
import { seismic } from "./it/layers/seismic.ts";
import { protectedAreas } from "./it/layers/protected-areas.ts";
import { terrain } from "./it/layers/terrain.ts";
import { solar } from "./it/layers/solar.ts";
import { services } from "./it/layers/services.ts";
import { demographics } from "./it/layers/demographics.ts";

const countries: Record<string, CountryAdapter> = {
  it: { code: "it", geocode, plotAt, plotById, layers: { flood, landslide, seismic, "protected-areas": protectedAreas, terrain, solar, services, demographics }, overlays: [overlay("cadastre", "Agenzia delle Entrate · CC BY 4.0"), overlay("flood", "ISPRA · CC BY-SA 4.0"), overlay("landslide", "ISPRA e Regioni / Province autonome · CC BY-SA 4.0")] },
};
export function getCountry(code: string): CountryAdapter {
  const country = countries[code];
  if (!country) throw new NotConfigured("Il paese richiesto non ha un adapter configurato.");
  return country;
}
