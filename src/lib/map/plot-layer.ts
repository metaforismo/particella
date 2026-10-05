import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { OVERLAY } from "./basemap";

const SOURCE = "plot";
const HATCH = "plot-hatch";

type PlotGeometry = { type: "Polygon" | "MultiPolygon"; coordinates: unknown[] };

/** Diagonal survey hatching, drawn once into a small tile MapLibre can repeat. */
function addHatchImage(map: MapLibreMap) {
  if (map.hasImage(HATCH)) return;
  const size = 12;
  const ratio = 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size * ratio;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  ctx.fillStyle = "rgb(245 197 24 / 0.22)";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = OVERLAY.plotFill;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "square";
  // Three strokes so the pattern tiles seamlessly across edges.
  for (const offset of [-size, 0, size]) {
    ctx.beginPath();
    ctx.moveTo(offset, size);
    ctx.lineTo(offset + size, 0);
    ctx.stroke();
  }
  map.addImage(HATCH, ctx.getImageData(0, 0, size * ratio, size * ratio), { pixelRatio: ratio });
}

/** Draws (or replaces) the highlighted plot. Pass `null` to clear it. */
export function setPlot(map: MapLibreMap, geometry: PlotGeometry | null) {
  const data = {
    type: "FeatureCollection" as const,
    features: geometry ? [{ type: "Feature" as const, properties: {}, geometry }] : [],
  };

  const existing = map.getSource<GeoJSONSource>(SOURCE);
  if (existing) {
    existing.setData(data as GeoJSON.FeatureCollection);
    return;
  }

  addHatchImage(map);
  map.addSource(SOURCE, { type: "geojson", data: data as GeoJSON.FeatureCollection });
  map.addLayer({
    id: "plot-fill",
    type: "fill",
    source: SOURCE,
    paint: { "fill-pattern": HATCH },
  });
  map.addLayer({
    id: "plot-halo",
    type: "line",
    source: SOURCE,
    paint: { "line-color": OVERLAY.plotHalo, "line-width": 6, "line-opacity": 0.9 },
  });
  map.addLayer({
    id: "plot-line",
    type: "line",
    source: SOURCE,
    paint: { "line-color": OVERLAY.plotLine, "line-width": 2 },
  });
}

/** Bounding box of a polygon geometry as [west, south, east, north]. */
export function geometryBounds(geometry: PlotGeometry): [number, number, number, number] {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  const visit = (node: unknown) => {
    if (Array.isArray(node) && typeof node[0] === "number") {
      const [x, y] = node as [number, number];
      w = Math.min(w, x);
      e = Math.max(e, x);
      s = Math.min(s, y);
      n = Math.max(n, y);
    } else if (Array.isArray(node)) {
      node.forEach(visit);
    }
  };
  visit(geometry.coordinates);
  return [w, s, e, n];
}
