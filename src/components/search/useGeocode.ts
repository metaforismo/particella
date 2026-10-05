"use client";

import { useEffect, useState } from "react";
import type { GeocodeResult } from "@/lib/contracts";

const DEBOUNCE_MS = 220;
const MIN_CHARS = 3;

type Settled = { query: string; results: GeocodeResult[]; error: boolean };

/** Debounced address lookup against `/api/v1/geocode`. Stale responses are dropped. */
export function useGeocode(query: string) {
  const q = query.trim();
  const [settled, setSettled] = useState<Settled>({ query: "", results: [], error: false });

  useEffect(() => {
    if (q.length < MIN_CHARS) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/geocode?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { results: GeocodeResult[] };
        setSettled({ query: q, results: body.results, error: false });
      } catch (err) {
        if ((err as Error).name !== "AbortError") setSettled({ query: q, results: [], error: true });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  if (q.length < MIN_CHARS) return { results: [], loading: false, error: false };
  const fresh = settled.query === q;
  // While a new query is in flight keep showing the previous list to avoid flicker.
  return { results: settled.results, loading: !fresh, error: fresh && settled.error };
}
