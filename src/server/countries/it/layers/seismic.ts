import { z } from "zod";
import dpc from "../../../../../data/snapshots/it-dpc-seismic-2025-05.json" with { type: "json" };
import type { LayerProvider } from "#server/core/layers.ts";
import { layerResult } from "#server/core/layers.ts";
import { provenance } from "#server/core/provenance.ts";
import { textBody } from "#server/core/http.ts";
import { UpstreamError } from "#server/core/errors.ts";
import { meters, latLonBox } from "#server/geo/index.ts";
import { gmlPoint, wfsMembers } from "#server/geo/gml.ts";
import { fetchSource } from "#server/countries/it/queries.ts";

export function parsePga(text: string) {
  return wfsMembers(text).map((member) => {
    const parsed = z.object({ iml: z.coerce.number().nonnegative(), id_punto: z.string() }).safeParse(member);
    if (!parsed.success) throw new UpstreamError("Valori PGA non validi.");
    return { center: gmlPoint(member.msGeometry), pga: parsed.data.iml, id: parsed.data.id_punto };
  });
}

export const seismic: LayerProvider = async (plot, { signal }) => {
  const zone = (dpc.zones as Record<string, string>)[plot.municipality?.istatCode ?? ""] ?? null;
  const sources = [provenance("dpc-seismic", { requestUrl: dpc.sourceUrl, retrievedAt: dpc.retrievedAt })];
  let closest:
    { center: { lat: number; lon: number }; pga: number; id: string; distanceM: number } | undefined;
  try {
    const payload = await fetchSource(
      "ingv-pga",
      {
        service: "WFS",
        version: "2.0.0",
        request: "GetFeature",
        typeNames: "ms:shkValsPoeCost_PGA_50oPerc_10poe_",
        srsName: "EPSG:4326",
        count: 100,
        bbox: `${latLonBox(plot.centroid, 0.15)},EPSG:4326`,
      },
      { signal },
    );
    const nodes = parsePga(textBody(payload))
      .map((n) => ({ ...n, distanceM: meters(plot.centroid, n.center) }))
      .sort((a, b) => a.distanceM - b.distanceM);
    closest = nodes[0];
    sources.push(provenance("ingv-pga", payload));
  } catch (error) {
    if (signal.aborted) throw error;
  }
  const zoneNumber = zone ? Number(zone[0]) : null;
  return layerResult("seismic", {
    status: zone && closest ? "ok" : zone || closest ? "partial" : "unavailable",
    scope: "municipality",
    headline: zone
      ? `Il comune è classificato in zona sismica ${zone}.`
      : "La classificazione comunale non è disponibile nei dati collegati.",
    severity:
      zoneNumber === 1
        ? "high"
        : zoneNumber === 2
          ? "medium"
          : zoneNumber === 3 || zoneNumber === 4
            ? "low"
            : "unknown",
    metrics: [
      {
        key: "zone",
        label: "Zona del comune",
        value: zone,
        unit: null,
        hint: "Classificazione DPC maggio 2025; eventuali sottoclassi regionali mantenute.",
      },
      {
        key: "pga",
        label: "PGA MPS04 del nodo più vicino",
        value: closest?.pga ?? null,
        unit: "g",
        hint: "Nodo del modello, non valore misurato sul lotto; 50° percentile, 10% di eccedenza in 50 anni.",
      },
      {
        key: "pga_node_distance",
        label: "Distanza del nodo dal punto",
        value: closest ? Math.round(closest.distanceM) : null,
        unit: "m",
      },
    ],
    features: closest
      ? {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [closest.center.lon, closest.center.lat] },
              properties: { classKey: "pga-node", pga: closest.pga, nodeId: closest.id },
            },
          ],
        }
      : null,
    legend: [
      ...["1", "2", "3", "4"].map((classKey) => ({ classKey, label: `Zona sismica ${classKey}` })),
      { classKey: "pga-node", label: "Nodo MPS04 selezionato" },
    ],
    method:
      "PGA: nodo MPS04 più vicino per distanza geodetica nella bbox ±0,15°, senza interpolazione; griglia ~0,05°. Classificazione DPC da snapshot per codice ISTAT.",
    notes: [
      "La zona descrive tutto il Comune. Il valore di accelerazione viene da un modello della zona, non da una misura sul terreno.",
      "Il modello risale al 2004–2006; un tecnico deve verificare le norme vigenti.",
      ...(!closest ? ["L’accelerazione sismica stimata non è disponibile."] : []),
      ...(!zone
        ? ["Il Comune è assente dai dati collegati: potrebbero non includere fusioni o modifiche recenti."]
        : []),
    ],
    provenance: sources,
  });
};
