import type { Metadata } from "next";
import { Studio, type StudioInitial } from "@/components/studio/Studio";

export const metadata: Metadata = {
  title: "Studio",
  description: "Scegli un terreno sulla mappa e leggi catasto, vincoli, rischi e contesto con le loro fonti.",
};

function toInitial(params: Record<string, string | string[] | undefined>): StudioInitial {
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const lat = Number(one("lat"));
  const lon = Number(one("lon"));
  const point =
    one("lat") &&
    one("lon") &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
      ? { lat, lon }
      : undefined;
  return { plotId: one("plot"), point, query: one("q") };
}

export default async function StudioPage({ searchParams }: PageProps<"/studio">) {
  return <Studio initial={toInitial(await searchParams)} />;
}
