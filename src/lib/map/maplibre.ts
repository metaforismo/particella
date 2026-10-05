"use client";

let loader: Promise<typeof import("maplibre-gl")> | null = null;

/** Loads MapLibre once, pointing it at the worker copied into /public by postinstall. */
export function loadMapLibre() {
  loader ??= import("maplibre-gl").then((maplibre) => {
    maplibre.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
    return maplibre;
  });
  return loader;
}
