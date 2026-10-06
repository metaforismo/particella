"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { looksCadastral } from "@/lib/cadastral";
import type { GeocodeResult } from "@/lib/contracts";

const DEBOUNCE_MS = 220;
const MIN_CHARS = 3;

type Settled = { query: string; results: GeocodeResult[]; error: boolean };

/** Debounced address lookup against `/api/v1/geocode`. Stale responses are dropped. */
export function useGeocode(query: string) {
  const q = query.trim();
  const [settled, setSettled] = useState<Settled>({ query: "", results: [], error: false });

  // Cadastral references are searched on submit only (see PlaceSearch), never while typing.
  const cadastral = looksCadastral(q);

  useEffect(() => {
    if (q.length < MIN_CHARS || cadastral) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const results = await api.geocode(q, controller.signal);
        setSettled({ query: q, results, error: false });
      } catch (err) {
        if ((err as Error).name !== "AbortError") setSettled({ query: q, results: [], error: true });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, cadastral]);

  if (q.length < MIN_CHARS || cadastral) return { results: [], loading: false, error: false, cadastral };
  const fresh = settled.query === q;
  // While a new query is in flight keep showing the previous list to avoid flicker.
  return { results: settled.results, loading: !fresh, error: fresh && settled.error, cadastral };
}
