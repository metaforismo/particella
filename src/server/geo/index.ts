import area from "@turf/area";
import bbox from "@turf/bbox";
import covers from "@turf/boolean-point-in-polygon";
import intersects from "@turf/boolean-intersects";
import contains from "@turf/boolean-contains";
import distance from "@turf/distance";
import length from "@turf/length";
import pointOnFeature from "@turf/point-on-feature";
import pointToLineDistance from "@turf/point-to-line-distance";
import { feature, point, lineString } from "@turf/helpers";
import proj4 from "proj4";
import type { Polygon, MultiPolygon, Position } from "geojson";
import type { LatLon } from "../../lib/contracts/index.ts";

export type PlotGeometry = Polygon | MultiPolygon;
proj4.defs("EPSG:6706", "+proj=longlat +ellps=GRS80 +no_defs +type=crs");
proj4.defs(
  "EPSG:3857",
  "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +no_defs",
);

// No time-dependent WGS84→ETRF2000 operation/grid is available in the MVP.
// Coordinates use the null datum approximation; this is stated in plot provenance.
export function toCadastre(p: LatLon): LatLon {
  const [lon, lat] = proj4("EPSG:4326", "EPSG:6706", [p.lon, p.lat]);
  return { lat, lon };
}
export function fromCadastre(lat: number, lon: number): Position {
  return proj4("EPSG:6706", "EPSG:4326", [lon, lat]);
}
export function coversPoint(geometry: PlotGeometry, p: LatLon): boolean {
  return covers(point([p.lon, p.lat]), geometry, { ignoreBoundary: false });
}
export function geometryBbox(geometry: PlotGeometry): [number, number, number, number] {
  return bbox(geometry) as [number, number, number, number];
}
export function representativePoint(geometry: PlotGeometry): LatLon {
  const [lon, lat] = pointOnFeature(geometry).geometry.coordinates;
  return { lat, lon };
}
export function measurements(geometry: PlotGeometry): { areaM2: number; perimeterM: number } {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return {
    areaM2: area(geometry),
    perimeterM: polygons.reduce(
      (sum, rings) => sum + rings.reduce((a, ring) => a + length(lineString(ring), { units: "meters" }), 0),
      0,
    ),
  };
}
export function meters(a: LatLon, b: LatLon): number {
  return distance([a.lon, a.lat], [b.lon, b.lat], { units: "meters" });
}
export function pointBox(p: LatLon, delta = 0.0001): [number, number, number, number] {
  return [p.lon - delta, p.lat - delta, p.lon + delta, p.lat + delta];
}
export function latLonBox(p: LatLon, delta = 0.0001): string {
  const b = pointBox(p, delta);
  return [b[1], b[0], b[3], b[2]].map((v) => v.toFixed(8)).join(",");
}
export function parcelSamples(geometry: PlotGeometry, divisions = 4): LatLon[] {
  const [west, south, east, north] = geometryBbox(geometry);
  const samples: LatLon[] = [];
  for (let y = 0; y <= divisions; y++)
    for (let x = 0; x <= divisions; x++) {
      const p = {
        lat: south + ((north - south) * y) / divisions,
        lon: west + ((east - west) * x) / divisions,
      };
      if (coversPoint(geometry, p)) samples.push(p);
    }
  samples.push(representativePoint(geometry));
  return [...new Map(samples.map((p) => [`${p.lat},${p.lon}`, p])).values()];
}
export function boundaryDistance(geometry: PlotGeometry, p: LatLon): number {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return Math.min(
    ...polygons.flatMap((rings) =>
      rings.map((ring) =>
        pointToLineDistance([p.lon, p.lat], lineString(ring), { units: "meters", method: "geodesic" }),
      ),
    ),
  );
}
export function spatialRelation(
  site: PlotGeometry,
  parcel: PlotGeometry | null,
  p: LatLon,
): { relation: "contains" | "intersects" | "nearby"; distanceM: number } {
  if (parcel) {
    const sites = site.type === "Polygon" ? [site.coordinates] : site.coordinates;
    const parcels = parcel.type === "Polygon" ? [parcel.coordinates] : parcel.coordinates;
    const fullyContained = parcels.every((coordinates) =>
      sites.some((rings) =>
        contains({ type: "Polygon", coordinates: rings }, { type: "Polygon", coordinates }),
      ),
    );
    if (fullyContained) return { relation: "contains", distanceM: 0 };
  }
  if (parcel && intersects(site, parcel)) return { relation: "intersects", distanceM: 0 };
  if (!parcel && coversPoint(site, p)) return { relation: "contains", distanceM: 0 };
  if (!parcel) return { relation: "nearby", distanceM: boundaryDistance(site, p) };
  const polygons = parcel.type === "Polygon" ? [parcel.coordinates] : parcel.coordinates;
  const sitePolygons = site.type === "Polygon" ? [site.coordinates] : site.coordinates;
  const a = polygons.flat(2).map(([lon, lat]) => boundaryDistance(site, { lat, lon }));
  const b = sitePolygons.flat(2).map(([lon, lat]) => boundaryDistance(parcel, { lat, lon }));
  return { relation: "nearby", distanceM: Math.min(...a, ...b) };
}
export function tileBbox(z: number, x: number, y: number): [number, number, number, number] {
  const half = 20037508.342789244,
    size = (2 * half) / 2 ** z;
  return [-half + x * size, half - (y + 1) * size, -half + (x + 1) * size, half - y * size];
}
export const geoFeature = (geometry: PlotGeometry) => feature(geometry);
