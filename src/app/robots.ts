import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    // Plot reports are personal lookups and the API calls public sources on every hit: keep crawlers out.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/scheda/"] },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
