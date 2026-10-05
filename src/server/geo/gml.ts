import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import type { Position } from "geojson";
import { UpstreamError } from "#server/core/errors.ts";
import { fromCadastre, type PlotGeometry } from "#server/geo/index.ts";

type XmlNode = Record<string, unknown>;

const object = (value: unknown): XmlNode =>
  value !== null && typeof value === "object" ? (value as XmlNode) : {};

export const list = (v: unknown): unknown[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export function xmlDocument(text: string): XmlNode {
  if (text.includes("<!DOCTYPE") || XMLValidator.validate(text) !== true)
    throw new UpstreamError("XML della fonte non valido.");
  const document = object(
    new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      parseTagValue: false,
      processEntities: false,
    }).parse(text),
  );
  if (document.ExceptionReport || document.ServiceExceptionReport)
    throw new UpstreamError("La fonte ha restituito un'eccezione OGC.");
  return document;
}

export function wfsMembers(text: string, requireConfirmedEmpty = false): XmlNode[] {
  const root = object(xmlDocument(text).FeatureCollection);
  if (!Object.keys(root).length) throw new UpstreamError("FeatureCollection WFS mancante.");
  const members = list(root.member ?? root.featureMember).map(object);
  if (requireConfirmedEmpty && !members.length && root["@_numberMatched"] === "unknown")
    throw new UpstreamError(
      "La fonte WFS non conferma la ricerca catastale da ID; selezionare il lotto sulla mappa.",
    );
  const matched = Number(root["@_numberMatched"]);
  const returned = Number(root["@_numberReturned"]);
  if (
    (Number.isFinite(matched) && matched > members.length) ||
    (Number.isFinite(returned) && returned > members.length)
  )
    throw new UpstreamError("Risposta WFS troncata: analisi incompleta.");
  return members.map((m) => object(Object.values(m)[0]));
}

const positions = z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(4);

function ring(value: unknown, crs: string): Position[] {
  const linear = object(object(value).LinearRing);
  const node = linear.posList;
  const record = object(node);
  const dimension = Number(record["@_srsDimension"] ?? 2);
  if (dimension !== 2) throw new UpstreamError("Dimensione GML non supportata.");
  const raw = String(record["#text"] ?? node ?? "")
    .trim()
    .split(/\s+/)
    .map(Number);
  if (raw.length % 2 || raw.some((n) => !Number.isFinite(n)))
    throw new UpstreamError("Coordinate GML non valide.");
  const points: Position[] = [];
  for (let i = 0; i < raw.length; i += 2)
    points.push(crs.includes("6706") ? fromCadastre(raw[i], raw[i + 1]) : [raw[i + 1], raw[i]]);
  const parsed = positions.safeParse(points);
  if (!parsed.success || points[0][0] !== points.at(-1)![0] || points[0][1] !== points.at(-1)![1])
    throw new UpstreamError("Anello GML non valido o non chiuso.");
  return points;
}

function polygons(node: XmlNode, inheritedCrs: string): Position[][][] {
  const result: Position[][][] = [];
  for (const [key, value] of Object.entries(node)) {
    for (const entry of list(value)) {
      const child = object(entry);
      const crs = String(child["@_srsName"] ?? inheritedCrs);
      if (key === "Polygon" || key === "PolygonPatch") {
        if (!/EPSG(?:::|:)(6706|4326)$/.test(crs)) throw new UpstreamError("CRS GML non supportato.");
        result.push([ring(child.exterior, crs), ...list(child.interior).map((x) => ring(x, crs))]);
      } else if (typeof entry === "object") result.push(...polygons(child, crs));
    }
  }
  return result;
}

export function gmlGeometry(value: unknown): PlotGeometry {
  const result = polygons(object(value), "urn:ogc:def:crs:EPSG::6706");
  if (!result.length) throw new UpstreamError("Geometria catastale mancante.");
  return result.length === 1
    ? { type: "Polygon", coordinates: result[0] }
    : { type: "MultiPolygon", coordinates: result };
}

export function gmlPoint(value: unknown): { lat: number; lon: number } {
  const node = object(object(value).Point);
  const crs = String(node["@_srsName"] ?? "");
  if (!/EPSG(?:::|:)4326$/.test(crs)) throw new UpstreamError("CRS del nodo PGA non riconosciuto.");
  const raw = String(node.pos ?? "")
    .trim()
    .split(/\s+/)
    .map(Number);
  const result = z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]).safeParse(raw);
  if (!result.success) throw new UpstreamError("Nodo PGA non valido.");
  return { lat: raw[0], lon: raw[1] };
}
