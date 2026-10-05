"use client";

import { useSyncExternalStore } from "react";
import type { Plot } from "@/lib/contracts";

export type RecentPlot = {
  id: string;
  label: string;
  place: string | null;
  areaM2: number | null;
  at?: { lat: number; lon: number };
};

const KEY = "particella:recent-plots";
const LIMIT = 6;
const listeners = new Set<() => void>();
const EMPTY: RecentPlot[] = [];
let snapshot: RecentPlot[] | null = null;

/** Storage can be unavailable (private mode, blocked site data): every access is guarded. */
function read(): RecentPlot[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isRecent).slice(0, LIMIT) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function isRecent(value: unknown): value is RecentPlot {
  const v = value as RecentPlot;
  return typeof v?.id === "string" && typeof v.label === "string";
}

export function rememberPlot(plot: Plot) {
  const entry: RecentPlot = {
    id: plot.id,
    label: plot.cadastral.label,
    place: plot.municipality?.name ?? null,
    areaM2: plot.areaM2,
    at: plot.centroid,
  };
  const next = [entry, ...read().filter((p) => p.id !== plot.id)].slice(0, LIMIT);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not persisted; the session still works.
  }
  snapshot = next;
  listeners.forEach((notify) => notify());
}

export function forgetRecentPlots() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  snapshot = EMPTY;
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function useRecentPlots() {
  return useSyncExternalStore(
    subscribe,
    () => (snapshot ??= read()),
    () => EMPTY,
  );
}
