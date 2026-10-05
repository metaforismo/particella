import type { CountryAdapter } from "#server/countries/types.ts";
import { NotConfigured } from "#server/core/errors.ts";
import { overlay } from "#server/core/layers.ts";
import { plotAt, plotById } from "#server/countries/it/cadastre.ts";
import { geocode } from "#server/countries/it/geocode.ts";
import { flood } from "#server/countries/it/layers/flood.ts";
import { landslide } from "#server/countries/it/layers/landslide.ts";
import { seismic } from "#server/countries/it/layers/seismic.ts";
import { protectedAreas } from "#server/countries/it/layers/protected-areas.ts";
import { terrain } from "#server/countries/it/layers/terrain.ts";
import { solar } from "#server/countries/it/layers/solar.ts";
import { services } from "#server/countries/it/layers/services.ts";
import { demographics } from "#server/countries/it/layers/demographics.ts";

import { landscape } from "#server/countries/it/layers/landscape.ts";
import { planning } from "#server/countries/it/layers/planning.ts";
import { landCover } from "#server/countries/it/layers/land-cover.ts";
import { accessibility } from "#server/countries/it/layers/accessibility.ts";
import { market } from "#server/countries/it/layers/market.ts";

const countries: Record<string, CountryAdapter> = {
  it: {
    code: "it",
    geocode,
    plotAt,
    plotById,
    layers: {
      flood,
      landslide,
      seismic,
      "protected-areas": protectedAreas,
      terrain,
      solar,
      services,
      demographics,
      landscape,
      planning,
      "land-cover": landCover,
      accessibility,
      market,
    },
    overlays: [
      overlay("cadastre", "Agenzia delle Entrate · CC BY 4.0"),
      overlay("flood", "ISPRA · CC BY-SA 4.0"),
      overlay("landslide", "ISPRA e Regioni / Province autonome · CC BY-SA 4.0"),
    ],
  },
};

export function getCountry(code: string): CountryAdapter {
  const country = countries[code];
  if (!country) throw new NotConfigured("Il paese richiesto non ha un adapter configurato.");
  return country;
}
