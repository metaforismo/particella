"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Plot } from "@/lib/contracts";
import { loadBasemapStyle } from "@/lib/map/basemap";
import { loadMapLibre } from "@/lib/map/maplibre";
import { geometryBounds, setPlot } from "@/lib/map/plot-layer";
import styles from "./ReportView.module.css";

/** Static plot map; keeps its drawing buffer so the canvas survives printing to PDF. */
export function ReportMap({ geometry }: { geometry: NonNullable<Plot["geometry"]> }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("maplibre-gl").Map | undefined;
    let disposed = false;
    Promise.all([loadMapLibre(), loadBasemapStyle()])
      .then(([maplibre, style]) => {
        if (disposed || !container.current) return;
        map = new maplibre.Map({
          container: container.current,
          style,
          bounds: geometryBounds(geometry),
          fitBoundsOptions: { padding: 48, maxZoom: 18.5 },
          interactive: false,
          attributionControl: { compact: false },
          canvasContextAttributes: { preserveDrawingBuffer: true },
        });
        map.once("load", () => {
          if (!map) return;
          map.addSource("cadastre", {
            type: "raster",
            tiles: ["/api/v1/tiles/cadastre/{z}/{x}/{y}"],
            tileSize: 256,
            minzoom: 15,
            attribution: "Catasto © Agenzia delle Entrate, CC BY 4.0",
          });
          map.addLayer({ id: "cadastre", type: "raster", source: "cadastre", paint: { "raster-opacity": 0.7 } });
          setPlot(map, geometry);
        });
      })
      .catch(() => {
        // Without the basemap the report still reads; the frame shows its survey grid.
      });
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [geometry]);

  return <div ref={container} className={styles.map} aria-label="Mappa del terreno" role="img" />;
}
