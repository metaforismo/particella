import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Particella",
    short_name: "Particella",
    description:
      "Cosa si può costruire su un terreno: catasto, vincoli, rischi e contesto dalle fonti pubbliche.",
    lang: "it",
    start_url: "/studio",
    scope: "/",
    display: "standalone",
    background_color: "#edefec",
    theme_color: "#edefec",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
