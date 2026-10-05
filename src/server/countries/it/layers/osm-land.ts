import { z } from "zod";
import type { LineString, Point, Polygon, Position } from "geojson";
import intersects from "@turf/boolean-intersects";
import pointToLineDistance from "@turf/point-to-line-distance";
import { lineString } from "@turf/helpers";
import type { Plot, LayerId } from "#contracts";
import { layerResult, type LayerProvider } from "#server/core/layers.ts";
import { jsonBody } from "#server/core/http.ts";
import { provenance } from "#server/core/provenance.ts";
import { source } from "#server/core/sources.ts";
import { NotConfigured, OutsideCoverage, UpstreamError } from "#server/core/errors.ts";
import {
  boundaryDistance,
  coversPoint,
  meters,
  spatialRelation,
  type PlotGeometry,
} from "#server/geo/index.ts";
import { fetchSource } from "#server/countries/it/queries.ts";

const Coordinate = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });

const Overpass = z.object({
  osm3s: z.object({ timestamp_osm_base: z.iso.datetime() }),
  remark: z.string().optional(),
  elements: z.array(
    z.object({
      type: z.enum(["node", "way"]),
      id: z.number().int().positive(),
      lat: Coordinate.shape.lat.optional(),
      lon: Coordinate.shape.lon.optional(),
      geometry: z.array(Coordinate.nullable()).optional(),
      tags: z.record(z.string(), z.string()),
    }),
  ),
});

export const gridLabels = {
  "grid-line": "Linea con tensione dichiarata ≥132 kV",
  substation: "Stazione elettrica censita in OSM",
};

export const infrastructureLabels = {
  motorway: "Autostrada",
  trunk: "Strada principale",
  primary: "Strada primaria",
  secondary: "Strada secondaria",
  rail: "Ferrovia",
  cemetery: "Cimitero",
  well: "Pozzo censito",
};

export const siteLabels = { industrial: "Area industriale", quarry: "Cava", landfill: "Discarica" };

type ClassKey =
  keyof typeof gridLabels | keyof typeof infrastructureLabels | keyof typeof siteLabels | "unknown-line";

type OSMGeometry = Point | LineString | Polygon;

export function voltageValues(tag?: string): number[] | null {
  if (!tag || !/^\d+(?:;\d+)*$/.test(tag)) return null;
  const values = tag.split(";").map(Number);
  return values.every((n) => Number.isSafeInteger(n) && n > 0) ? values : null;
}

function classify(tags: Record<string, string>): ClassKey | null {
  if (tags.power === "line") {
    const volts = voltageValues(tags.voltage);
    return !volts ? "unknown-line" : Math.max(...volts) >= 132000 ? "grid-line" : null;
  }
  if (tags.power === "substation") return "substation";
  if (Object.hasOwn(infrastructureLabels, tags.highway)) return tags.highway as ClassKey;
  if (tags.railway === "rail") return "rail";
  if (tags.landuse === "cemetery" || tags.amenity === "grave_yard") return "cemetery";
  if (tags.man_made === "water_well") return "well";
  if (Object.hasOwn(siteLabels, tags.landuse)) return tags.landuse as ClassKey;
  return null;
}

export function distanceFromPlot(plot: Pick<Plot, "geometry" | "centroid">, geometry: OSMGeometry): number {
  const parcel = plot.geometry as PlotGeometry | null;
  if (geometry.type === "Polygon") return spatialRelation(geometry, parcel, plot.centroid).distanceM;
  if (geometry.type === "Point") {
    const p = { lon: geometry.coordinates[0], lat: geometry.coordinates[1] };
    return parcel ? (coversPoint(parcel, p) ? 0 : boundaryDistance(parcel, p)) : meters(plot.centroid, p);
  }
  if (!parcel)
    return pointToLineDistance([plot.centroid.lon, plot.centroid.lat], geometry, { units: "meters" });
  if (intersects(parcel, geometry)) return 0;
  const rings = parcel.type === "Polygon" ? parcel.coordinates : parcel.coordinates.flat();
  const fromParcel = rings.flat().map((p) => pointToLineDistance(p, geometry, { units: "meters" }));
  const fromLine = geometry.coordinates.map(([lon, lat]) => boundaryDistance(parcel, { lat, lon }));
  return Math.min(...fromParcel, ...fromLine);
}

export function parseOsmLand(value: unknown, plot: Pick<Plot, "geometry" | "centroid">) {
  const result = Overpass.safeParse(value);
  if (!result.success || result.data.remark)
    throw new UpstreamError("Overpass non ha completato la ricerca.");
  const missing = new Set<ClassKey>();
  let unknownLines = 0;
  const features = result.data.elements.flatMap((e) => {
    const classKey = classify(e.tags);
    if (!classKey) return [];
    if (classKey === "unknown-line") {
      unknownLines++;
      return [];
    }
    let geometry: OSMGeometry;
    if (e.type === "node" && e.lon !== undefined && e.lat !== undefined) {
      geometry = { type: "Point", coordinates: [e.lon, e.lat] };
    } else if (
      e.type === "way" &&
      e.geometry &&
      e.geometry.length >= 2 &&
      e.geometry.every((p) => p !== null)
    ) {
      const positions: Position[] = e.geometry.map((p) => [p!.lon, p!.lat]);
      const closed =
        positions.length >= 4 &&
        positions[0][0] === positions.at(-1)![0] &&
        positions[0][1] === positions.at(-1)![1];
      geometry =
        closed && ["industrial", "quarry", "landfill", "cemetery", "substation"].includes(classKey)
          ? { type: "Polygon", coordinates: [positions] }
          : lineString(positions).geometry;
    } else {
      missing.add(classKey);
      return [];
    }
    const distanceM = distanceFromPlot(plot, geometry);
    if (distanceM > (Object.hasOwn(gridLabels, classKey) ? 10000 : 2000)) return [];
    return [
      {
        type: "Feature" as const,
        id: `${e.type}/${e.id}`,
        geometry,
        properties: {
          classKey,
          osmId: `${e.type}/${e.id}`,
          name: e.tags.name ?? null,
          voltage: e.tags.voltage ?? null,
          substation: e.tags.substation ?? null,
          distanceM: Math.round(distanceM),
          exactDistanceM: distanceM,
        },
      },
    ];
  });
  return {
    features: [...new Map(features.map((f) => [f.id, f])).values()],
    missing,
    unknownLines,
    referenceDate: result.data.osm3s.timestamp_osm_base,
  };
}

export function osmLandQuery(plot: Pick<Plot, "geometry" | "centroid">): string {
  const p = plot.centroid;
  const rings =
    plot.geometry?.type === "Polygon" ? plot.geometry.coordinates : (plot.geometry?.coordinates.flat() ?? []);
  const extent = Math.max(0, ...rings.flat().map(([lon, lat]) => meters(p, { lat, lon })));
  if (extent > 2000)
    throw new OutsideCoverage(
      "La ricerca OSM non copre terreni estesi oltre due chilometri dal punto rappresentativo.",
    );
  const box = (r: number) => {
    // Conservative latitude/longitude box; results are filtered by geometric distance.
    const dy = (r + extent) / 110000;
    const dx = dy / Math.cos(((p.lat + dy) * Math.PI) / 180);
    return [p.lat - dy, p.lon - dx, p.lat + dy, p.lon + dx].map((n) => n.toFixed(6)).join(",");
  };
  const large = box(10000);
  const small = box(2000);
  return `[out:json][timeout:15];(way(${large})[power=line];nw(${large})[power=substation];way(${small})[highway~"^(motorway|trunk|primary|secondary)$"];way(${small})[railway=rail];nw(${small})[landuse~"^(cemetery|industrial|quarry|landfill)$"];nw(${small})[amenity=grave_yard];node(${small})[man_made=water_well];);out geom tags;`;
}

function osmLayer(layer: LayerId, labels: Record<string, string>, title: string): LayerProvider {
  return async (plot, { signal }) => {
    if (
      process.env.NODE_ENV === "production" &&
      ["overpass-api.de", "overpass.kumi.systems"].includes(new URL(source("overpass").endpoint).host)
    )
      throw new NotConfigured(
        "Configurare OVERPASS_URL con un servizio dedicato per lo scouting commerciale.",
      );
    // All three providers share this exact URL and HttpClient deduplicates the in-flight request.
    const payload = await fetchSource(
      "overpass",
      { data: osmLandQuery(plot) },
      { signal, timeoutMs: 22_000, retries: 1 },
    );
    const data = parseOsmLand(jsonBody(payload), plot);
    const features = data.features.filter((f) => Object.hasOwn(labels, f.properties.classKey));
    const incomplete =
      [...data.missing].some((k) => Object.hasOwn(labels, k)) ||
      (layer === "power-grid" && data.unknownLines > 0);
    const nearest = (rows: typeof features) =>
      rows.length ? Math.round(Math.min(...rows.map((f) => f.properties.exactDistanceM))) : null;
    return layerResult(layer, {
      status: incomplete ? "partial" : features.length ? "ok" : "empty",
      scope: "buffer",
      severity: "unknown",
      headline: features.length
        ? `OpenStreetMap censisce ${features.length} ${title} nei dintorni.`
        : incomplete
          ? "La ricerca OpenStreetMap è incompleta per queste infrastrutture."
          : "OpenStreetMap non restituisce elementi delle categorie cercate nei dintorni.",
      metrics: [
        ...Object.entries(labels).map(([key, label]) => ({
          key: `${key}-nearest`,
          label: `${label}: distanza minima censita`,
          value: data.missing.has(key as ClassKey)
            ? null
            : nearest(features.filter((f) => f.properties.classKey === key)),
          unit: "m",
        })),
        ...(layer === "power-grid"
          ? [
              {
                key: "unknown-voltage-lines",
                label: "Linee senza tensione interpretabile nella ricerca",
                value: data.unknownLines,
                unit: "linee",
              },
              {
                key: "hv-substation-nearest",
                label: "Stazione con tensione dichiarata ≥132 kV: distanza minima censita",
                value: data.missing.has("substation")
                  ? null
                  : nearest(
                      features.filter(
                        (f) =>
                          f.properties.classKey === "substation" &&
                          Math.max(...(voltageValues(f.properties.voltage ?? undefined) ?? [0])) >= 132000,
                      ),
                    ),
                unit: "m",
              },
            ]
          : []),
        {
          key: "search-radius",
          label: "Raggio di ricerca dal terreno",
          value: layer === "power-grid" ? 10000 : 2000,
          unit: "m",
        },
      ],
      features: { type: "FeatureCollection", features },
      legend: Object.entries(labels).map(([classKey, label]) => ({ classKey, label })),
      method:
        "Overpass: nodi e way con geometrie, bbox conservative e filtro finale a 10 km (rete) / 2 km (altre infrastrutture). Distanza geodetica minima fra geometria OSM e confine del lotto, zero se intersecano; senza poligono distanza dal punto rappresentativo. voltage in volt, lista separata da punto e virgola; soglia ≥132000. Relazioni OSM non interrogate.",
      notes: [
        "Dati collaborativi incompleti: l’elemento più vicino censito può non essere quello più vicino nella realtà.",
        plot.geometry
          ? "Le distanze sono in linea d’aria dal confine del terreno."
          : "Senza il confine del terreno le distanze partono dal punto controllato.",
        ...(layer === "power-grid"
          ? [
              "Una stazione OSM non è necessariamente una cabina primaria. La tensione è quella dichiarata dai contributori.",
              "La distanza non attesta potenza disponibile, accesso alla rete, costo o possibilità di connessione: verificare con il gestore.",
              ...(data.unknownLines
                ? [
                    "Alcune linee non riportano una tensione interpretabile e sono escluse dal confronto delle linee ad alta tensione.",
                  ]
                : []),
            ]
          : layer === "infrastructure-distances"
            ? [
                "Queste distanze non sono fasce di rispetto legali. Strade, ferrovie, cimiteri e pozzi richiedono verifiche presso gli enti competenti.",
                "I pozzi censiti non sono necessariamente punti di captazione di acqua potabile.",
              ]
            : [
                "Il censimento non attesta contaminazione, attività attuale o idoneità alle rinnovabili. Una cava o discarica può essere dismessa o descritta in modo incompleto.",
              ]),
        ...(incomplete
          ? ["Mancano informazioni su alcuni elementi: i dati disponibili non completano il censimento."]
          : []),
        "© OpenStreetMap contributors, ODbL 1.0. Sono esclusi gli elementi descritti solo come relazioni.",
      ],
      provenance: [
        provenance("overpass", payload, {
          dataset: "Infrastrutture e usi del suolo — OpenStreetMap",
          referenceDate: data.referenceDate,
        }),
      ],
    });
  };
}

export const powerGrid = osmLayer("power-grid", gridLabels, "elementi della rete elettrica entro 10 km");

export const infrastructureDistances = osmLayer(
  "infrastructure-distances",
  infrastructureLabels,
  "infrastrutture entro 2 km",
);

export const industrialSites = osmLayer(
  "industrial-sites",
  siteLabels,
  "aree industriali, cave e discariche entro 2 km",
);
