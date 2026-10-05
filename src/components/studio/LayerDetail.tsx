import { ArrowSquareOut } from "@phosphor-icons/react";
import type { LayerMeta } from "@/content/layers";
import type { LayerResult } from "@/lib/contracts";
import { formatDate, formatMetric } from "@/lib/format";
import { uniqueSources } from "@/lib/provenance";
import { classColor } from "@/lib/map/layer-style";
import styles from "./LayerDetail.module.css";

const SCOPE_LABEL: Record<LayerResult["scope"], string> = {
  parcel: "Calcolato sul confine della particella",
  point: "Riferito al punto scelto sulla mappa",
  buffer: "Calcolato nei dintorni del terreno",
  grid_cell: "Riferito alla cella censuaria di 1 km",
  municipality: "Riferito all'intero Comune",
  zone: "Riferito alla zona di appartenenza",
};

function isWebUrl(url: string) {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export function LayerDetail({ result, meta }: { result: LayerResult; meta: LayerMeta }) {
  return (
    <div className={styles.detail}>
      <p className={styles.scope}>{SCOPE_LABEL[result.scope]}</p>

      {result.metrics.length ? (
        <dl className={styles.metrics}>
          {result.metrics.map((m) => (
            <div key={m.key} title={m.value != null ? (m.hint ?? undefined) : undefined}>
              <dt>{m.label}</dt>
              {m.value == null && m.hint ? (
                <dd className={styles.absent}>{m.hint}</dd>
              ) : (
                <dd className="num">{formatMetric(m.value, m.unit)}</dd>
              )}
            </div>
          ))}
        </dl>
      ) : null}

      {result.legend.length ? (
        <ul className={styles.legend} aria-label="Legenda">
          {result.legend.map((item) => (
            <li key={item.classKey}>
              <span
                className={styles.chip}
                style={{ background: classColor(result.layer, item.classKey, meta.tone) }}
                aria-hidden="true"
              />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}

      {result.notes.length ? (
        <ul className={styles.notes}>
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      {result.method ? (
        <details className={styles.method}>
          <summary>Come è calcolato</summary>
          <p>{result.method}</p>
        </details>
      ) : null}

      <div className={styles.sources}>
        <p className={styles.sourcesTitle}>Fonti</p>
        <ul>
          {uniqueSources(result.provenance).map((p) => (
            <li key={`${p.sourceId}-${p.dataset}`}>
              {isWebUrl(p.url) ? (
                <a href={p.url} target="_blank" rel="noreferrer" className={styles.sourceLink}>
                  <span>
                    <strong>{p.authority}</strong> · {p.dataset}
                  </span>
                  <ArrowSquareOut size={13} aria-hidden="true" />
                </a>
              ) : (
                <span className={styles.sourceLink}>
                  <span>
                    <strong>{p.authority}</strong> · {p.dataset}
                  </span>
                </span>
              )}
              <span className={styles.sourceMeta}>
                {p.license} · letto il {formatDate(p.retrievedAt)}
                {p.referenceDate ? ` · dato al ${p.referenceDate}` : ""}
                {p.isOfficial ? "" : " · fonte non ufficiale"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
