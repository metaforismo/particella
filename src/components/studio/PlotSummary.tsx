"use client";

import { LegendSwatch } from "@/components/legend/LegendSwatch";
import { LAYERS } from "@/content/layers";
import type { LayerId, LayerResult } from "@/lib/contracts";
import type { LayerState } from "./useStudio";
import styles from "./PlotSummary.module.css";

type Props = {
  layers: Partial<Record<LayerId, LayerState>>;
  onOpen: (id: LayerId) => void;
};

const RANK = { high: 0, medium: 1, low: 2 } as const;

/**
 * What weighs on this plot, in reading order: what the plan says, what to look into, what to
 * note, and which data is missing. Built only from layer results, never from a score.
 */
export function PlotSummary({ layers, onOpen }: Props) {
  const results = LAYERS.flatMap((meta) => {
    const state = layers[meta.id];
    return state?.status === "done" ? [{ meta, result: state.result }] : [];
  });
  const answered = (r: LayerResult) => r.status === "ok" || r.status === "partial";

  const planning = results.find(({ meta, result }) => meta.id === "planning" && answered(result));
  const flagged = results
    .filter(({ result }) => answered(result) && result.severity in RANK)
    .sort(
      (a, b) => RANK[a.result.severity as keyof typeof RANK] - RANK[b.result.severity as keyof typeof RANK],
    );
  const missing = LAYERS.filter((meta) => {
    const state = layers[meta.id];
    return (
      state?.status === "failed" ||
      (state?.status === "done" && ["unavailable", "error", "outside_coverage"].includes(state.result.status))
    );
  });

  if (!planning && !flagged.length && !missing.length) {
    return (
      <section className={styles.summary} aria-label="Quadro del terreno">
        <p className={styles.clear}>
          Nessuno dei livelli analizzati segnala elementi da approfondire. Verifica comunque il piano
          urbanistico presso il Comune.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.summary} aria-labelledby="summary-title">
      <h2 id="summary-title" className={styles.title}>
        Quadro del terreno
      </h2>

      {planning ? (
        <button type="button" className={styles.lead} onClick={() => onOpen("planning")}>
          <span className={styles.kicker}>Cosa dice il piano</span>
          <span>{planning.result.headline}</span>
        </button>
      ) : null}

      {flagged.length ? (
        <ul className={styles.items}>
          {flagged.map(({ meta, result }) => (
            <li key={meta.id}>
              <button
                type="button"
                className={styles.item}
                data-severity={result.severity}
                onClick={() => onOpen(meta.id)}
              >
                <LegendSwatch symbol={meta.symbol} tone={meta.tone} size={14} />
                <span>
                  <strong>{meta.title}</strong>
                  <span className={styles.headline}>{result.headline}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {missing.length ? (
        <p className={styles.missing}>
          Mancano: {missing.map((m) => m.title.toLowerCase()).join(", ")}. Un dato mancante non indica
          l&apos;assenza di vincoli.
        </p>
      ) : null}
    </section>
  );
}
