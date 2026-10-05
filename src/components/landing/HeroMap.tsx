"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { loadBasemapStyle } from "@/lib/map/basemap";
import { loadMapLibre } from "@/lib/map/maplibre";
import { geometryBounds, setPlot } from "@/lib/map/plot-layer";
import type { Plot } from "@/lib/contracts";
import styles from "./HeroMap.module.css";

type Props = {
  geometry: NonNullable<Plot["geometry"]>;
  /** Fires once the camera has settled on the plot, to start the readout sequence. */
  onArrive?: () => void;
};

export function HeroMap({ geometry, onArrive }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const arrive = useRef(onArrive);
  useEffect(() => {
    arrive.current = onArrive;
  }, [onArrive]);

  useEffect(() => {
    let disposed = false;
    let map: import("maplibre-gl").Map | undefined;

    (async () => {
      try {
        const [{ Map }, style] = await Promise.all([loadMapLibre(), loadBasemapStyle()]);
        if (disposed || !container.current) return;

        const bounds = geometryBounds(geometry);
        const center: [number, number] = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        map = new Map({
          container: container.current,
          style,
          center,
          zoom: reduceMotion ? 17 : 13.2,
          interactive: false,
          attributionControl: { compact: true },
          fadeDuration: 0,
        });

        map.once("load", () => {
          if (!map) return;
          setPlot(map, geometry);
          const padding = paddingFor(container.current);
          map.fitBounds(bounds, {
            padding,
            maxZoom: 18,
            duration: reduceMotion ? 0 : 2600,
            essential: false,
          });
          map.once("moveend", () => arrive.current?.());
        });
      } catch {
        if (!disposed) setFailed(true);
        arrive.current?.();
      }
    })();

    return () => {
      disposed = true;
      map?.remove();
    };
  }, [geometry]);

  return (
    <div className={styles.frame} data-failed={failed || undefined}>
      <div ref={container} className={styles.map} aria-hidden="true" />
    </div>
  );
}

/** Keep the plot clear of the readout card, which sits bottom-left on wide screens. */
function paddingFor(el: HTMLElement | null) {
  const wide = (el?.clientWidth ?? 0) > 560;
  return wide
    ? { top: 80, right: 60, bottom: 80, left: 380 }
    : { top: 40, right: 40, bottom: 220, left: 40 };
}
