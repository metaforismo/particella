"use client";

import { CaretDown } from "@phosphor-icons/react";
import { LegendSwatch } from "@/components/legend/LegendSwatch";
import { GROUP_LABEL, LAYERS, type LayerMeta } from "@/content/layers";
import type { LayerGroup, LayerId } from "@/lib/contracts";
import { LayerDetail } from "./LayerDetail";
import { StatusPill } from "./StatusPill";
import { stateLabel, summarize } from "./status";
import type { LayerState } from "./useStudio";
import styles from "./LayerList.module.css";

type Props = {
  layers: Partial<Record<LayerId, LayerState>>;
  active: LayerId | null;
  onToggle: (id: LayerId | null) => void;
};

const GROUPS = Object.keys(GROUP_LABEL) as LayerGroup[];

export function LayerList({ layers, active, onToggle }: Props) {
  const counts = summarize(LAYERS.map((l) => layers[l.id]));

  return (
    <div className={styles.wrap}>
      <p className={styles.summary} aria-live="polite">
        {counts.pending > 0 ? (
          <>
            Sto leggendo le fonti: <span className="num">{LAYERS.length - counts.pending}</span> di{" "}
            <span className="num">{LAYERS.length}</span>
          </>
        ) : (
          <>
            <Count n={counts.attention} one="da approfondire" many="da approfondire" tone="medium" />
            <Count n={counts.notable} one="da notare" many="da notare" tone="low" />
            <Count n={counts.clear} one="senza rilievi" many="senza rilievi" tone="none" />
            <Count n={counts.missing} one="non disponibile" many="non disponibili" tone="unknown" />
          </>
        )}
      </p>
      {counts.pending > 0 ? (
        <div className={styles.progress} aria-hidden="true">
          <span style={{ width: `${((LAYERS.length - counts.pending) / LAYERS.length) * 100}%` }} />
        </div>
      ) : null}

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
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Count({ n, one, many, tone }: { n: number; one: string; many: string; tone: string }) {
  if (n === 0) return null;
  return (
    <span className={styles.count} data-tone={tone}>
      <span className="num">{n}</span> {n === 1 ? one : many}
    </span>
  );
}

function LayerRow({
  meta,
  state,
  open,
  onToggle,
}: {
  meta: LayerMeta;
  state: LayerState | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  const { tone, label } = stateLabel(state);
  const loading = !state || state.status === "loading";
  const headline =
    state?.status === "done"
      ? state.result.headline
      : state?.status === "failed"
        ? state.message
        : `Interrogo ${meta.authority}…`;
  const panelId = `layer-${meta.id}`;

  return (
    <li className={styles.row} data-open={open || undefined} data-loading={loading || undefined}>
      <button
        type="button"
        className={styles.rowButton}
        aria-expanded={open}
        aria-controls={panelId}
        disabled={loading}
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
      {open && state?.status === "done" ? (
        <div id={panelId} className={styles.detail}>
          <LayerDetail result={state.result} meta={meta} />
        </div>
      ) : null}
    </li>
  );
}
