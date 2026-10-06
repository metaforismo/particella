import type { VercelConfig } from "@vercel/config/v1";

/** Route-level maxDuration exports are authoritative for Next.js App Router functions. */
export const config: VercelConfig = {
  framework: "nextjs",
  regions: ["fra1"],
  fluid: true,
  functions: {
    "src/app/api/v1/geocode/route.ts": { maxDuration: 300 },
    "src/app/api/v1/lots/route.ts": { maxDuration: 300 },
    "src/app/api/v1/plots/**/*": { maxDuration: 300 },
    "src/app/scheda/**/*": { maxDuration: 300 },
  },
  headers: [
    {
      source: "/api/v1/tiles/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=604800, s-maxage=604800" }],
    },
    {
      source: "/api/v1/catalog/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=86400, s-maxage=86400" }],
    },
  ],
};
