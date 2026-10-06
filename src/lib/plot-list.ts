"use client";

import { useSyncExternalStore } from "react";
import type { Plot } from "@/lib/contracts";
import { plotLocation, type PlotLocation } from "@/lib/routes";

/** The minimum needed to show a plot in a list and to reopen it on any server instance. */
export type PlotRef = {
  id: string;
  label: string;
  place: string | null;
  areaM2: number | null;
  at?: PlotLocation;
};

export function plotRef(plot: Plot): PlotRef {
  return {
    id: plot.id,
    label: plot.cadastral.label,
    place: plot.municipality?.name ?? null,
    areaM2: plot.areaM2,
    at: plotLocation(plot),
  };
}

const EMPTY: PlotRef[] = [];

function isPlotRef(value: unknown): value is PlotRef {
  const v = value as PlotRef;
  return typeof v?.id === "string" && typeof v.label === "string";
}

/**
 * A small list of plots persisted in localStorage and shared by every component that reads it.
 * Storage can be unavailable (private mode, blocked site data), so every access is guarded and the
 * list keeps working in memory for the session.
 */
export function createPlotList(key: string, limit: number) {
  const listeners = new Set<() => void>();
  let snapshot: PlotRef[] | null = null;

  const read = (): PlotRef[] => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
      return Array.isArray(parsed) ? parsed.filter(isPlotRef).slice(0, limit) : EMPTY;
    } catch {
      return EMPTY;
    }
  };

  const write = (next: PlotRef[]) => {
    try {
      if (next.length) localStorage.setItem(key, JSON.stringify(next));
      else localStorage.removeItem(key);
    } catch {
      // Not persisted; the in-memory snapshot still serves this session.
    }
    snapshot = next;
    listeners.forEach((notify) => notify());
  };

  const current = () => (snapshot ??= read());

  return {
    /** Adds to the front; an existing entry moves to the front instead of duplicating. */
    add(entry: PlotRef) {
      write([entry, ...current().filter((p) => p.id !== entry.id)].slice(0, limit));
    },
    remove(id: string) {
      write(current().filter((p) => p.id !== id));
    },
    clear() {
      write(EMPTY);
    },
    has(id: string) {
      return current().some((p) => p.id === id);
    },
    useList() {
      return useSyncExternalStore(
        (notify) => {
          listeners.add(notify);
          return () => listeners.delete(notify);
        },
        current,
        () => EMPTY,
      );
    },
    limit,
  };
}
