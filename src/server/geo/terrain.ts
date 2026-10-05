import type { LatLon } from "#contracts";

export interface HeightSample {
  center: LatLon;
  elevation: number;
}

// Fit z=a*x+b*y+c in a local metric tangent plane. Singular/small samples have no slope.
export function estimateGradient(samples: HeightSample[]): { east: number; north: number } | null {
  if (samples.length < 3) return null;
  const origin = samples[0].center;
  const radians = Math.PI / 180;
  const points = samples.map((s) => ({
    x: (s.center.lon - origin.lon) * radians * 6371008.8 * Math.cos(origin.lat * radians),
    y: (s.center.lat - origin.lat) * radians * 6371008.8,
    z: s.elevation,
  }));
  const mean = (key: "x" | "y" | "z") => points.reduce((sum, p) => sum + p[key], 0) / points.length;
  const mx = mean("x");
  const my = mean("y");
  const mz = mean("z");
  let xx = 0;
  let yy = 0;
  let xy = 0;
  let xz = 0;
  let yz = 0;
  for (const p of points) {
    const x = p.x - mx;
    const y = p.y - my;
    const z = p.z - mz;
    xx += x * x;
    yy += y * y;
    xy += x * y;
    xz += x * z;
    yz += y * z;
  }
  const determinant = xx * yy - xy * xy;
  if (determinant < 1 || xx < 100 || yy < 100) return null;
  return { east: (xz * yy - yz * xy) / determinant, north: (yz * xx - xz * xy) / determinant };
}

export function estimateSlope(samples: HeightSample[]): number | null {
  const gradient = estimateGradient(samples);
  return gradient ? 100 * Math.hypot(gradient.east, gradient.north) : null;
}

/** Downslope azimuth clockwise from north. Nearly flat samples have no meaningful aspect. */
export function estimateAspect(samples: HeightSample[]): number | null {
  const gradient = estimateGradient(samples);
  if (!gradient || Math.hypot(gradient.east, gradient.north) < 0.005) return null;
  return ((Math.atan2(-gradient.east, -gradient.north) * 180) / Math.PI + 360) % 360;
}
