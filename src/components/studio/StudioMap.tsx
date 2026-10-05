"use client";

import { useEffect, useRef, useState } from "react";
import type { FilterSpecification, Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LAYER_BY_ID } from "@/content/layers";
import type { LatLon, LayerResult, Plot } from "@/lib/contracts";
import { loadBasemapStyle, OVERLAY } from "@/lib/map/basemap";
import { featureColorExpression } from "@/lib/map/layer-style";
import { loadMapLibre } from "@/lib/map/maplibre";
import { geometryBounds, setPlot } from "@/lib/map/plot-layer";
import styles from "./StudioMap.module.css";

const ITALY: [number, number, number, number] = [6.6, 36.6, 18.6, 47.1];
const CADASTRE_MIN_ZOOM = 15;
const ANALYSIS = "analysis";

const isType = (...types: string[]) =>
  ["match", ["geometry-type"], types, true, false] as unknown as FilterSpecification;

type Props = {
  plot: Plot | null;
  pending: LatLon | null;
  activeResult: LayerResult | null;
  showCadastre: boolean;
  /** Extra room the map must leave for floating panels, in px. */
  inset: { left: number; right: number; bottom: number };
  onPick: (point: LatLon) => void;
};

export function StudioMap({ plot, pending, activeResult, showCadastre, inset, onPick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(5);
  const pick = useRef(onPick);
  const insetRef = useRef(inset);

  useEffect(() => {
    pick.current = onPick;
    insetRef.current = inset;
  }, [onPick, inset]);

  // Create the map once.
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const [maplibre, style] = await Promise.all([loadMapLibre(), loadBasemapStyle()]);
        if (disposed || !container.current) return;
        const map = new maplibre.Map({
          container: container.current,
          style,
          bounds: ITALY,
          fitBoundsOptions: { padding: initialPadding(container.current) },
          attributionControl: { compact: true },
          maxPitch: 0,
          dragRotate: false,
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "bottom-right");
        map.addControl(new maplibre.ScaleControl({ unit: "metric", maxWidth: 110 }), "bottom-right");
        map.on("click", (e) => pick.current({ lat: e.lngLat.lat, lon: e.lngLat.lng }));
        map.on("zoomend", () => setZoom(map.getZoom()));
        map.once("load", () => {
          map.addSource("cadastre", {
            type: "raster",
            tiles: ["/api/v1/tiles/cadastre/{z}/{x}/{y}"],
            tileSize: 256,
            minzoom: CADASTRE_MIN_ZOOM,
            attribution: "Catasto © Agenzia delle Entrate, CC BY 4.0",
          });
          map.addLayer({
            id: "cadastre",
            type: "raster",
            source: "cadastre",
            minzoom: CADASTRE_MIN_ZOOM,
            paint: { "raster-opacity": 0.6, "raster-saturation": -0.6, "raster-contrast": 0.15 },
          });
          setPlot(map, null);
          setReady(true);
        });
        mapRef.current = map;
        markerRef.current = new maplibre.Marker({ element: surveyPoint() });
      } catch {
        if (!disposed) setFailed(true);
      }
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Pending point marker while the plot is being resolved.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    if (pending) marker.setLngLat([pending.lon, pending.lat]).addTo(map);
    else marker.remove();
  }, [pending, ready]);

  // Plot outline + camera.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    setPlot(map, plot?.geometry ?? null);
    if (!plot) return;
    const { left, right, bottom } = insetRef.current;
    const padding = { top: 90, left: left + 48, right: right + 48, bottom: bottom + 48 };
    if (plot.geometry) {
      map.fitBounds(geometryBounds(plot.geometry), { padding, maxZoom: 18.5, duration: 900 });
    } else {
      map.easeTo({ center: [plot.centroid.lon, plot.centroid.lat], zoom: 17, padding, duration: 900 });
    }
  }, [plot, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty("cadastre", "visibility", showCadastre ? "visible" : "none");
  }, [showCadastre, ready]);

  // Active analysis layer: vector features and raster overlays.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    clearAnalysis(map);
    if (!activeResult) return;

    const meta = LAYER_BY_ID[activeResult.layer];
    for (const overlay of activeResult.overlays) {
      if (!overlay.tileUrl.startsWith("/api/v1/tiles/")) continue;
      const id = `${ANALYSIS}-raster-${overlay.id}`;
      map.addSource(id, {
        type: "raster",
        tiles: [overlay.tileUrl],
        tileSize: 256,
        // MapLibre renders attribution as HTML; upstream text must never become markup.
        attribution: escapeHtml(overlay.attribution),
      });
      map.addLayer(
        { id, type: "raster", source: id, paint: { "raster-opacity": overlay.opacity } },
        "plot-fill",
      );
    }

    if (activeResult.features?.features.length) {
      const color = featureColorExpression(activeResult.layer, meta.tone);
      map.addSource(ANALYSIS, { type: "geojson", data: activeResult.features as GeoJSON.FeatureCollection });
      map.addLayer(
        {
          id: `${ANALYSIS}-fill`,
          type: "fill",
          source: ANALYSIS,
          filter: isType("Polygon", "MultiPolygon"),
          paint: { "fill-color": color, "fill-opacity": 0.22 },
        },
        "plot-fill",
      );
      map.addLayer(
        {
          id: `${ANALYSIS}-line`,
          type: "line",
          source: ANALYSIS,
          filter: isType("Polygon", "MultiPolygon", "LineString", "MultiLineString"),
          paint: { "line-color": color, "line-width": 1.6 },
        },
        "plot-fill",
      );
      map.addLayer({
        id: `${ANALYSIS}-point`,
        type: "circle",
        source: ANALYSIS,
        filter: isType("Point", "MultiPoint"),
        paint: {
          "circle-radius": 5,
          "circle-color": color,
          "circle-stroke-color": OVERLAY.plotHalo,
          "circle-stroke-width": 1.5,
        },
      });
    }
  }, [activeResult, ready]);

  const cadastreHint = showCadastre && ready && zoom >= 11 && zoom < CADASTRE_MIN_ZOOM - 0.5;

  return (
    <div className={styles.frame}>
      <div ref={container} className={styles.map} />
      {cadastreHint ? (
        <p className={styles.hint} style={{ left: `calc(50% + ${(inset.left - inset.right) / 2}px)` }}>
          Avvicinati per vedere i confini delle particelle
        </p>
      ) : null}
      {failed ? (
        <p className={styles.failed}>La mappa non si è caricata. Ricarica la pagina per riprovare.</p>
      ) : null}
    </div>
  );
}

function clearAnalysis(map: MapLibreMap) {
  for (const layer of map.getStyle().layers) {
    if (layer.id.startsWith(ANALYSIS)) map.removeLayer(layer.id);
  }
  for (const id of Object.keys(map.getStyle().sources)) {
    if (id.startsWith(ANALYSIS)) map.removeSource(id);
  }
}

/** Frame Italy beside the side panel on desktop, above the bottom sheet on phones. */
function initialPadding(el: HTMLElement) {
  const { clientWidth: w, clientHeight: h } = el;
  if (w <= 820) return { top: 80, bottom: Math.round(h * 0.46) + 16, left: 16, right: 16 };
  return { top: 70, bottom: 30, left: 384 + 40, right: 30 };
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function surveyPoint() {
  const el = document.createElement("div");
  el.className = styles.pending;
  el.setAttribute("aria-hidden", "true");
  return el;
}
