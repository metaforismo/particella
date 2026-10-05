import type { LayerResult, Severity } from "@/lib/contracts";
import type { LayerState } from "./useStudio";

export type Tone = Severity | "pending";

/** One label per state, written for someone who is not a planner. */
export function stateLabel(state: LayerState | undefined): { tone: Tone; label: string } {
  if (!state || state.status === "loading") return { tone: "pending", label: "In lettura" };
  if (state.status === "failed") return { tone: "unknown", label: "Non disponibile" };
  return resultLabel(state.result);
}

export function resultLabel(result: LayerResult): { tone: Tone; label: string } {
  switch (result.status) {
    case "outside_coverage":
      return { tone: "unknown", label: "Fuori copertura" };
    case "unavailable":
    case "error":
      return { tone: "unknown", label: "Non disponibile" };
    case "empty":
      return { tone: "none", label: "Nessun elemento" };
  }
  switch (result.severity) {
    case "high":
      return { tone: "high", label: "Rilevante" };
    case "medium":
      return { tone: "medium", label: "Da approfondire" };
    case "low":
      return { tone: "low", label: "Da notare" };
    case "none":
      return { tone: "none", label: "Nessun rilievo" };
    default:
      return { tone: "unknown", label: "Dato incompleto" };
  }
}

export function summarize(states: (LayerState | undefined)[]) {
  const counts = { attention: 0, notable: 0, clear: 0, missing: 0, pending: 0 };
  for (const state of states) {
    const { tone } = stateLabel(state);
    if (tone === "pending") counts.pending++;
    else if (tone === "high" || tone === "medium") counts.attention++;
    else if (tone === "low") counts.notable++;
    else if (tone === "none") counts.clear++;
    else counts.missing++;
  }
  return counts;
}
