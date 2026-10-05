import type { Plot } from "@/lib/contracts";

type Ring = [number, number][];

function polygons(geometry: NonNullable<Plot["geometry"]>): Ring[][] {
  return geometry.type === "Polygon" ? [geometry.coordinates as Ring[]] : (geometry.coordinates as Ring[][]);
}

function fileName(plot: Plot, extension: string) {
  const { municipalityCode, sheet, parcel } = plot.cadastral;
  return `particella-${municipalityCode}-F${sheet}-P${parcel}.${extension}`;
}

export function plotGeoJson(plot: Plot) {
  const feature = {
    type: "Feature",
    properties: {
      id: plot.id,
      comune: plot.municipality?.name ?? null,
      codiceCatastale: plot.cadastral.municipalityCode,
      sezione: plot.cadastral.section,
      foglio: plot.cadastral.sheet,
      particella: plot.cadastral.parcel,
      superficieM2: plot.areaM2,
      fonte: plot.provenance.map((p) => `${p.authority}, ${p.dataset} (${p.license})`).join("; "),
    },
    geometry: plot.geometry,
  };
  return {
    name: fileName(plot, "geojson"),
    type: "application/geo+json",
    body: JSON.stringify({ type: "FeatureCollection", features: [feature] }, null, 2),
  };
}

const escapeXml = (text: string) =>
  text.replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!,
  );

export function plotKml(plot: Plot) {
  const coords = (ring: Ring) => ring.map(([lon, lat]) => `${lon},${lat},0`).join(" ");
  const boundary = (tag: string, ring: Ring) =>
    `<${tag}><LinearRing><coordinates>${coords(ring)}</coordinates></LinearRing></${tag}>`;
  const polygon = ([outer, ...holes]: Ring[]) =>
    `<Polygon>${boundary("outerBoundaryIs", outer)}${holes.map((h) => boundary("innerBoundaryIs", h)).join("")}</Polygon>`;
  const shapes = plot.geometry ? polygons(plot.geometry).map(polygon).join("") : "";
  const name = escapeXml(
    `${plot.municipality?.name ?? plot.cadastral.municipalityCode} — ${plot.cadastral.label}`,
  );
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${name}</name>
<Style id="lotto"><LineStyle><color>ff1d2017</color><width>2</width></LineStyle><PolyStyle><color>6618c5f5</color></PolyStyle></Style>
<Placemark><name>${name}</name><description>${escapeXml("Fonte: Agenzia delle Entrate, cartografia catastale (CC BY 4.0)")}</description><styleUrl>#lotto</styleUrl><MultiGeometry>${shapes}</MultiGeometry></Placemark>
</Document></kml>`;
  return { name: fileName(plot, "kml"), type: "application/vnd.google-earth.kml+xml", body };
}

export function download({ name, type, body }: { name: string; type: string; body: string }) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
