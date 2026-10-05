"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { api, ApiRequestError } from "@/lib/api/client";
import type { LatLon, LayerId, LayerResult, Plot } from "@/lib/contracts";
import { LAYERS } from "@/content/layers";
import { formatAt } from "@/lib/routes";
import { rememberPlot } from "./recent";

export type Selection =
  | { status: "idle" }
  | { status: "locating"; point: LatLon | null }
  | { status: "ready"; plot: Plot }
  | { status: "error"; point: LatLon | null; message: string };

export type LayerState =
  { status: "loading" } | { status: "done"; result: LayerResult } | { status: "failed"; message: string };

type State = {
  selection: Selection;
  layers: Partial<Record<LayerId, LayerState>>;
  activeLayer: LayerId | null;
};

type Action =
  | { type: "locate"; point: LatLon | null }
  | { type: "plot"; plot: Plot }
  | { type: "fail"; point: LatLon | null; message: string }
  | { type: "layer"; id: LayerId; state: LayerState }
  | { type: "activate"; id: LayerId | null }
  | { type: "clear" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "locate":
      return { selection: { status: "locating", point: action.point }, layers: {}, activeLayer: null };
    case "plot":
      return {
        ...state,
        selection: { status: "ready", plot: action.plot },
        layers: Object.fromEntries(LAYERS.map((l) => [l.id, { status: "loading" }])),
      };
    case "fail":
      return { ...state, selection: { status: "error", point: action.point, message: action.message } };
    case "layer":
      return { ...state, layers: { ...state.layers, [action.id]: action.state } };
    case "activate":
      return { ...state, activeLayer: action.id };
    case "clear":
      return { selection: { status: "idle" }, layers: {}, activeLayer: null };
  }
}

function describe(error: unknown) {
  if (error instanceof ApiRequestError) {
    switch (error.code) {
      case "not_found":
      case "bad_request":
        // The server explains the specific case (road, water, boundary between parcels).
        return (
          error.message ||
          "Qui non troviamo una particella catastale. Prova un punto all'interno di un lotto."
        );
      case "upstream_unavailable":
        return "Il servizio catastale non risponde in questo momento. Riprova tra qualche minuto.";
      case "network":
        return "Connessione assente o instabile. Controlla la rete e riprova.";
      default:
        return error.message;
    }
  }
  return "Qualcosa non ha funzionato nel recupero del terreno. Riprova.";
}

function describeLayerError(error: unknown) {
  if (error instanceof ApiRequestError) {
    switch (error.code) {
      case "upstream_unavailable":
        return "La fonte non ha risposto in tempo. Puoi riprovare tra poco.";
      case "rate_limited":
        return "La fonte limita le richieste: riprova tra qualche secondo.";
      case "network":
        return "Connessione assente o instabile.";
    }
  }
  return "Questo livello non è disponibile in questo momento.";
}

/** Owns plot selection and the progressive loading of every analysis layer. */
export function useStudio() {
  const [state, dispatch] = useReducer(reducer, {
    selection: { status: "idle" },
    layers: {},
    activeLayer: null,
  });
  const inflight = useRef<AbortController | null>(null);

  const loadLayer = useCallback((plot: Plot, id: LayerId, signal: AbortSignal) => {
    dispatch({ type: "layer", id, state: { status: "loading" } });
    api
      .layer(plot.id, id, plot.centroid, signal)
      .then((result) => dispatch({ type: "layer", id, state: { status: "done", result } }))
      .catch((error: unknown) => {
        if ((error as Error).name === "AbortError") return;
        dispatch({ type: "layer", id, state: { status: "failed", message: describeLayerError(error) } });
      });
  }, []);

  const run = useCallback(
    async (point: LatLon | null, fetchPlot: (signal: AbortSignal) => Promise<Plot>) => {
      inflight.current?.abort();
      const controller = new AbortController();
      inflight.current = controller;
      dispatch({ type: "locate", point });
      try {
        const plot = await fetchPlot(controller.signal);
        dispatch({ type: "plot", plot });
        syncUrl(plot);
        rememberPlot(plot);
        for (const { id } of LAYERS) loadLayer(plot, id, controller.signal);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        dispatch({ type: "fail", point, message: describe(error) });
      }
    },
    [loadLayer],
  );

  const selectPoint = useCallback(
    (point: LatLon) => run(point, (signal) => api.plotAt(point.lat, point.lon, signal)),
    [run],
  );

  /** `at` is a point inside the plot; without it the server may be unable to find the parcel. */
  const selectPlotId = useCallback(
    (id: string, at?: LatLon) => run(at ?? null, (signal) => api.plot(id, at, signal)),
    [run],
  );

  const plot = state.selection.status === "ready" ? state.selection.plot : null;
  const retryLayer = useCallback(
    (id: LayerId) => {
      const signal = inflight.current?.signal;
      if (plot && signal && !signal.aborted) loadLayer(plot, id, signal);
    },
    [plot, loadLayer],
  );

  const setActiveLayer = useCallback(
    (id: LayerId | null) => {
      dispatch({ type: "activate", id });
      if (plot) syncUrl(plot, id);
    },
    [plot],
  );

  const clear = useCallback(() => {
    inflight.current?.abort();
    dispatch({ type: "clear" });
    syncUrl(null);
  }, []);

  useEffect(() => () => inflight.current?.abort(), []);

  return { ...state, selectPoint, selectPlotId, setActiveLayer, retryLayer, clear };
}

/** Keep the address bar shareable without triggering a navigation. */
function syncUrl(plot: Plot | null, layer: LayerId | null = null) {
  const url = new URL(window.location.href);
  const params = new URLSearchParams();
  if (plot) {
    params.set("plot", plot.id);
    params.set("at", formatAt(plot.centroid));
    if (layer) params.set("layer", layer);
  }
  url.search = params.size ? `?${params}` : "";
  window.history.replaceState(null, "", url);
}
