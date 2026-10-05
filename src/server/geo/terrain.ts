import type { LatLon } from "../../lib/contracts/index.ts";
export interface HeightSample {
  center: LatLon;
  elevation: number;
}
// Fit z=a*x+b*y+c in a local metric tangent plane. Singular/small samples have no slope.
export function estimateSlope(samples: HeightSample[]): number | null {
  if (samples.length < 3) return null;
  const origin = samples[0].center,
    radians = Math.PI / 180;
  const points = samples.map((s) => ({
    x: (s.center.lon - origin.lon) * radians * 6371008.8 * Math.cos(origin.lat * radians),
    y: (s.center.lat - origin.lat) * radians * 6371008.8,
    z: s.elevation,
  }));
  const mean = (key: "x" | "y" | "z") => points.reduce((sum, p) => sum + p[key], 0) / points.length;
  const mx = mean("x"),
    my = mean("y"),
    mz = mean("z");
  let xx = 0,
    yy = 0,
    xy = 0,
    xz = 0,
    yz = 0;
  for (const p of points) {
    const x = p.x - mx,
      y = p.y - my,
      z = p.z - mz;
    xx += x * x;
    yy += y * y;
    xy += x * y;
    xz += x * z;
    yz += y * z;
  }
  const determinant = xx * yy - xy * xy;
  if (determinant < 1 || xx < 100 || yy < 100) return null;
  return 100 * Math.hypot((xz * yy - yz * xy) / determinant, (yz * xx - xz * xy) / determinant);
}
