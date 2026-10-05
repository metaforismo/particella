import type { CountryCode, GeocodeResult, LayerId, MapOverlay, Plot } from "../../lib/contracts/index.ts";
import type { LayerProvider } from "../core/layers.ts";
export interface CountryAdapter {
  code: CountryCode;
  geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult[]>;
  plotAt(lat: number, lon: number, signal?: AbortSignal): Promise<Plot>;
  plotById(id: string, signal?: AbortSignal): Promise<Plot>;
  layers: Partial<Record<LayerId, LayerProvider>>;
  overlays: MapOverlay[];
}
