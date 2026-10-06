import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/studio`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/fonti`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/sviluppatori`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/condizioni`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
