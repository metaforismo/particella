import type { StyleSpecification } from "maplibre-gl";

const BASE_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/** Survey-sheet palette applied over OpenFreeMap Positron. Keys are Positron layer ids. */
const PAINT: Record<string, Record<string, unknown>> = {
  background: { "background-color": "#edefec" },
  park: { "fill-color": "#dde7d8" },
  landcover_wood: { "fill-color": "#d3dfcd" },
  landuse_residential: { "fill-color": "#e6e8e4" },
  water: { "fill-color": "#c6d9e6" },
  waterway: { "line-color": "#98b9d0" },
  building: { "fill-color": "#dde1dc", "fill-outline-color": "#c8cec9" },
  highway_path: { "line-color": "#e2e6e2" },
  highway_minor: { "line-color": "#f8f9f7" },
  highway_major_casing: { "line-color": "#cfd5d0" },
  highway_major_inner: { "line-color": "#fbfcfa" },
  highway_motorway_casing: { "line-color": "#c5ccc7" },
  highway_motorway_inner: { "line-color": "#fbfcfa" },
  railway: { "line-color": "#c5ccc7" },
  railway_transit: { "line-color": "#c5ccc7" },
  railway_service: { "line-color": "#c5ccc7" },
  boundary_2: { "line-color": "#a9b2ac" },
  boundary_3: { "line-color": "#a9b2ac" },
  water_name_point_label: { "text-color": "#2d6a96", "text-halo-color": "#edefec" },
  water_name_line_label: { "text-color": "#2d6a96", "text-halo-color": "#edefec" },
  waterway_line_label: { "text-color": "#4f84aa", "text-halo-color": "#edefec" },
  "highway-name-minor": { "text-color": "#6f7a74", "text-halo-color": "#f8f9f7" },
  "highway-name-major": { "text-color": "#47524d", "text-halo-color": "#f8f9f7" },
  "highway-name-path": { "text-color": "#6f7a74", "text-halo-color": "#edefec" },
};

const PLACE_LABEL = { "text-color": "#17201d", "text-halo-color": "#edefec" };

let cached: Promise<StyleSpecification> | null = null;

/** Positron recoloured to the Particella palette. Fetched once per page. */
export function loadBasemapStyle(): Promise<StyleSpecification> {
  cached ??= fetch(BASE_STYLE_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`Basemap style ${res.status}`);
      return res.json() as Promise<StyleSpecification>;
    })
    .then((style) => {
      for (const layer of style.layers) {
        if (
          layer.type === "symbol" &&
          layer.layout &&
          JSON.stringify(layer.layout["text-field"] ?? "").includes("name")
        ) {
          layer.layout["text-field"] = [
            "coalesce",
            ["get", "name:it"],
            ["get", "name:latin"],
            ["get", "name"],
          ];
        }
        const paint = PAINT[layer.id] ?? (layer.id.startsWith("label_") ? PLACE_LABEL : null);
        if (paint && "paint" in layer) {
          layer.paint = { ...(layer.paint as object), ...paint } as typeof layer.paint;
        }
      }
      return style;
    })
    .catch((error) => {
      cached = null;
      throw error;
    });
  return cached;
}

/** Colours the map uses for analysis overlays, kept beside the basemap so they stay in tune. */
export const OVERLAY = {
  plotFill: "#f5c518",
  plotLine: "#17201d",
  plotHalo: "#f9faf8",
  cadastreLine: "#8b5e34",
} as const;
