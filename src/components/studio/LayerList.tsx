"use client";

import { ArrowClockwise, CaretDown } from "@phosphor-icons/react";
import { LegendSwatch } from "@/components/legend/LegendSwatch";
import { GROUP_LABEL, LAYERS, type LayerMeta } from "@/content/layers";
import type { LayerGroup, LayerId } from "@/lib/contracts";
import { LayerDetail } from "./LayerDetail";
import { PlotSummary } from "./PlotSummary";
import { StatusPill } from "./StatusPill";
import { stateLabel, summarize } from "./status";
import type { LayerState } from "./useStudio";
import styles from "./LayerList.module.css";

type Props = {
  layers: Partial<Record<LayerId, LayerState>>;
  active: LayerId | null;
  onToggle: (id: LayerId | null) => void;
  onRetry: (id: LayerId) => void;
};

const GROUPS = Object.keys(GROUP_LABEL) as LayerGroup[];

export function LayerList({ layers, active, onToggle, onRetry }: Props) {
  const counts = summarize(LAYERS.map((l) => layers[l.id]));

  return (
    <div className={styles.wrap}>
      {counts.pending > 0 ? (
        <p className={styles.summary} aria-live="polite">
          <span>
            Fonti lette: <span className="num">{LAYERS.length - counts.pending}</span> di{" "}
            <span className="num">{LAYERS.length}</span>
          </span>
        </p>
      ) : null}
      {counts.pending > 0 ? (
        <div className={styles.progress} aria-hidden="true">
          <span style={{ width: `${((LAYERS.length - counts.pending) / LAYERS.length) * 100}%` }} />
        </div>
      ) : (
        <PlotSummary
          layers={layers}
          onOpen={(id) => {
            onToggle(id);
            requestAnimationFrame(() =>
              document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
            );
          }}
        />
      )}

      {GROUPS.map((group) => (
        <section key={group} className={styles.group} aria-labelledby={`group-${group}`}>
          <h2 id={`group-${group}`} className={styles.groupTitle}>
            {GROUP_LABEL[group]}
          </h2>
          <ul>
            {LAYERS.filter((l) => l.group === group).map((meta) => (
              <LayerRow
                key={meta.id}
                meta={meta}
                state={layers[meta.id]}
                open={active === meta.id}
                onToggle={() => onToggle(active === meta.id ? null : meta.id)}
                onRetry={() => onRetry(meta.id)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function LayerRow({
  meta,
  state,
  open,
  onToggle,
  onRetry,
}: {
  meta: LayerMeta;
  state: LayerState | undefined;
  open: boolean;
  onToggle: () => void;
  onRetry: () => void;
}) {
  const { tone, label } = stateLabel(state);
  const loading = !state || state.status === "loading";
  const headline =
    state?.status === "done"
      ? state.result.headline
      : state?.status === "failed"
        ? state.message
        : `Lettura da ${meta.authority}…`;
  const panelId = `layer-${meta.id}`;
  const retriable =
    state?.status === "failed" ||
    (state?.status === "done" && (state.result.status === "unavailable" || state.result.status === "error"));

  return (
    <li
      id={`row-${meta.id}`}
      className={styles.row}
      data-open={open || undefined}
      data-loading={loading || undefined}
    >
      <button
        type="button"
        className={styles.rowButton}
        aria-expanded={open}
        aria-controls={panelId}
        disabled={loading || state?.status === "failed"}
        onClick={onToggle}
      >
        <LegendSwatch symbol={meta.symbol} tone={meta.tone} size={16} />
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{meta.title}</span>
          <span className={styles.rowHeadline}>{headline}</span>
        </span>
        <span className={styles.rowEnd}>
          <StatusPill tone={tone} label={label} />
          {!loading ? <CaretDown size={14} className={styles.caret} aria-hidden="true" /> : null}
        </span>
      </button>
      {retriable ? (
        <button type="button" className={styles.retry} onClick={onRetry}>
          <ArrowClockwise size={13} aria-hidden="true" /> Riprova
        </button>
      ) : null}
      {open && state?.status === "done" ? (
        <div id={panelId} className={styles.detail}>
          <LayerDetail result={state.result} meta={meta} />
        </div>
      ) : null}
    </li>
  );
}
