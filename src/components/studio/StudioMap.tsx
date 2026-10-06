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
/** Below this zoom a click lands on an arbitrary parcel, so it zooms in instead of selecting. */
const PICK_MIN_ZOOM = 14;
const ANALYSIS = "analysis";

const isType = (...types: string[]) =>
  ["match", ["geometry-type"], types, true, false] as unknown as FilterSpecification;

type Props = {
  plot: Plot | null;
  pending: LatLon | null;
  activeResult: LayerResult | null;
  showCadastre: boolean;
  composing: boolean;
  /** Extra room the map must leave for floating panels, in px. */
  inset: { left: number; right: number; bottom: number };
  /** `additive`: the user asked to add or remove this parcel (Shift+click) rather than replace. */
  onPick: (point: LatLon, additive: boolean) => void;
};

export function StudioMap({ plot, pending, activeResult, showCadastre, composing, inset, onPick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [slow, setSlow] = useState(false);
  const [zoom, setZoom] = useState(5);
  const pick = useRef(onPick);
  const insetRef = useRef(inset);
  const plotRef = useRef(plot);

  useEffect(() => {
    pick.current = onPick;
    insetRef.current = inset;
    plotRef.current = plot;
  }, [onPick, inset, plot]);

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
        map.on("click", (e) => {
          if (map.getZoom() < PICK_MIN_ZOOM) {
            map.flyTo({ center: e.lngLat, zoom: 16.5, speed: 1.6 });
            return;
          }
          pick.current({ lat: e.lngLat.lat, lon: e.lngLat.lng }, e.originalEvent.shiftKey);
        });
        const syncZoom = () => {
          setZoom(map.getZoom());
          map.getCanvas().style.cursor = map.getZoom() < PICK_MIN_ZOOM ? "zoom-in" : "";
        };
        map.on("zoomend", syncZoom);
        map.once("idle", syncZoom);
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

  // A map that is still blank after a while is reported, never left grey in silence.
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setSlow(true), 15_000);
    return () => clearTimeout(timer);
  }, [ready]);

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
      revealFeatures(map, activeResult.features.features, plotRef.current, insetRef.current);
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

  const hint = !ready
    ? null
    : composing
      ? "Tocca le particelle confinanti per aggiungerle o toglierle"
      : zoom < PICK_MIN_ZOOM
        ? "Tocca la mappa per avvicinarti, poi scegli il lotto"
        : showCadastre && zoom < CADASTRE_MIN_ZOOM - 0.5
          ? "Avvicinati ancora per vedere i confini delle particelle"
          : null;

  return (
    <div className={styles.frame}>
      <div
        ref={container}
        className={styles.map}
        role="application"
        aria-label="Mappa: tocca un punto per scegliere un terreno, oppure usa la ricerca"
      />
      {hint && (!plot || composing) ? (
        <p className={styles.hint} style={{ left: `calc(50% + ${(inset.left - inset.right) / 2}px)` }}>
          {hint}
        </p>
      ) : null}
      {failed || (slow && !ready) ? (
        <div className={styles.failed} role="alert">
          <p>
            {failed
              ? "La mappa non si è caricata."
              : "La mappa sta impiegando più del previsto. La connessione potrebbe essere lenta."}
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Ricarica la pagina
          </button>
        </div>
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

/**
 * When a layer's features reach well beyond the plot (isochrones, nearby services), frame plot and
 * features together. Compared with the plot rather than the current view, because the camera may
 * still be flying in when the layer arrives.
 */
function revealFeatures(
  map: MapLibreMap,
  features: GeoJSON.Feature[],
  plot: Plot | null,
  inset: Props["inset"],
) {
  type Box = [number, number, number, number];
  const union = (a: Box | null, b: Box): Box =>
    a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : b;
  let reach: Box | null = null;
  for (const feature of features) {
    if (!feature.geometry || feature.geometry.type === "GeometryCollection") continue;
    reach = union(reach, geometryBounds(feature.geometry as Parameters<typeof geometryBounds>[0]));
  }
  if (!reach || !Number.isFinite(reach[0])) return;
  const base: Box = plot?.geometry
    ? geometryBounds(plot.geometry)
    : [
        plot?.centroid.lon ?? reach[0],
        plot?.centroid.lat ?? reach[1],
        plot?.centroid.lon ?? reach[2],
        plot?.centroid.lat ?? reach[3],
      ];
  const span = (b: Box) => Math.max(b[2] - b[0], b[3] - b[1]);
  // Features within about twice the plot's size are already visible around it.
  if (span(union(base, reach)) <= span(base) * 2) return;
  map.fitBounds(union(base, reach), {
    padding: { top: 90, left: inset.left + 40, right: inset.right + 40, bottom: inset.bottom + 40 },
    maxZoom: 17,
    duration: 800,
  });
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
