import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { LegendSwatch } from "@/components/legend/LegendSwatch";
import { StatusPill } from "@/components/studio/StatusPill";
import { resultLabel } from "@/components/studio/status";
import { GROUP_LABEL, LAYER_BY_ID, LAYERS } from "@/content/layers";
import type { LayerGroup, LayerResult, PlotReport, Provenance } from "@/lib/contracts";
import { formatArea, formatDate, formatLength, formatMetric, formatPlace } from "@/lib/format";
import { uniqueSources } from "@/lib/provenance";
import { formatAt } from "@/lib/routes";
import { PrintButton } from "./PrintButton";
import { ReportPersonalization } from "./ReportPersonalization";
import { ReportMap } from "./ReportMap";
import styles from "./ReportView.module.css";

const GROUPS = Object.keys(GROUP_LABEL) as LayerGroup[];
const ORDER = new Map(LAYERS.map((l, i) => [l.id, i]));

/** Numbers every distinct source once, so layers can cite them like footnotes. */
function indexSources(report: PlotReport) {
  const index = new Map<string, { n: number; source: Provenance }>();
  const key = (p: Provenance) => `${p.sourceId}|${p.dataset}`;
  for (const p of [...report.plot.provenance, ...report.layers.flatMap((l) => l.provenance)]) {
    if (!index.has(key(p))) index.set(key(p), { n: index.size + 1, source: p });
  }
  return { list: [...index.values()], cite: (p: Provenance) => index.get(key(p))!.n };
}

export function ReportView({ report }: { report: PlotReport }) {
  const { plot } = report;
  const sources = indexSources(report);
  const layers = [...report.layers].sort((a, b) => (ORDER.get(a.layer) ?? 99) - (ORDER.get(b.layer) ?? 99));
  const attention = layers.filter(
    (l) =>
      (l.status === "ok" || l.status === "partial") && (l.severity === "high" || l.severity === "medium"),
  );
  const missing = layers.filter((l) => ["unavailable", "error", "outside_coverage"].includes(l.status));

  return (
    <article className={styles.page}>
      <header className={styles.masthead}>
        <span className={styles.brand}>
          <LogoMark size={20} /> Particella
        </span>
        <span className={styles.meta}>
          Scheda generata il {formatDate(report.generatedAt)} · <span className={styles.id}>{plot.id}</span>
        </span>
        <div className={styles.actions}>
          <Link
            href={`/studio?plot=${encodeURIComponent(plot.id)}&at=${formatAt(plot.centroid)}`}
            className={styles.secondary}
          >
            Apri nello Studio
          </Link>
          <PrintButton className={styles.primary} />
        </div>
      </header>

      <ReportPersonalization plotId={plot.id} />

      <section className={styles.identity}>
        <div>
          <p className={styles.place}>{formatPlace(plot.municipality)}</p>
          <h1 className={styles.title}>
            Foglio <span className="num">{plot.cadastral.sheet}</span>, particella{" "}
            <span className="num">{plot.cadastral.parcel}</span>
          </h1>
          {plot.address ? <p className={styles.address}>{plot.address}</p> : null}
          <dl className={styles.measures}>
            <div>
              <dt>Superficie</dt>
              <dd className="num">{formatArea(plot.areaM2)}</dd>
            </div>
            <div>
              <dt>Perimetro</dt>
              <dd className="num">{formatLength(plot.perimeterM)}</dd>
            </div>
            <div>
              <dt>Codice catastale</dt>
              <dd>{plot.cadastral.municipalityCode}</dd>
            </div>
            <div>
              <dt>Codice ISTAT</dt>
              <dd className="num">{plot.municipality?.istatCode ?? "—"}</dd>
            </div>
          </dl>
          <p className={styles.small}>
            Misure calcolate sul poligono della mappa catastale
            {uniqueSources(plot.provenance).map((p) => (
              <sup key={`${p.sourceId}-${p.dataset}`}>[{sources.cite(p)}]</sup>
            ))}
            , non la superficie censuaria.
          </p>
        </div>
        {plot.geometry ? <ReportMap geometry={plot.geometry} /> : null}
      </section>

      <section className={styles.summary} aria-labelledby="summary-title">
        <h2 id="summary-title">In sintesi</h2>
        {attention.length ? (
          <ul>
            {attention.map((l) => (
              <li key={l.layer}>
                <strong>{l.title}.</strong> {l.headline}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nessuno dei livelli analizzati segnala elementi da approfondire.</p>
        )}
        {missing.length ? (
          <p className={styles.missing}>
            Non disponibili al momento della generazione:{" "}
            {missing.map((l) => l.title.toLowerCase()).join(", ")}. L&apos;assenza di un dato non indica
            l&apos;assenza di un vincolo.
          </p>
        ) : null}
      </section>

      {GROUPS.map((group) => {
        const inGroup = layers.filter((l) => l.group === group);
        if (!inGroup.length) return null;
        return (
          <section key={group} className={styles.group}>
            <h2>{GROUP_LABEL[group]}</h2>
            {inGroup.map((layer) => (
              <LayerBlock key={layer.layer} layer={layer} cite={sources.cite} />
            ))}
          </section>
        );
      })}

      <section className={styles.sources} aria-labelledby="sources-title">
        <h2 id="sources-title">Fonti</h2>
        <ol>
          {sources.list.map(({ n, source }) => (
            <li key={n} value={n}>
              <strong>{source.authority}</strong>, {source.dataset}. {source.license}. Consultato il{" "}
              {formatDate(source.retrievedAt)}
              {source.referenceDate ? `, dato riferito a ${source.referenceDate}` : ""}.{" "}
              <a href={source.url}>{source.url}</a>
            </li>
          ))}
        </ol>
      </section>

      <footer className={styles.footer}>
        Questa scheda ha valore orientativo. Non sostituisce il certificato di destinazione urbanistica, le
        verifiche presso gli uffici competenti né il parere di un tecnico abilitato. I dati provengono dalle
        fonti elencate e possono non essere aggiornati.
      </footer>
    </article>
  );
}

function LayerBlock({ layer, cite }: { layer: LayerResult; cite: (p: Provenance) => number }) {
  const meta = LAYER_BY_ID[layer.layer];
  const { tone, label } = resultLabel(layer);
  return (
    <div className={styles.layer}>
      <div className={styles.layerHead}>
        {meta ? <LegendSwatch symbol={meta.symbol} tone={meta.tone} size={14} /> : null}
        <h3>{layer.title}</h3>
        <StatusPill tone={tone} label={label} />
      </div>
      <p className={styles.headline}>
        {layer.headline}
        {uniqueSources(layer.provenance).map((p) => (
          <sup key={`${p.sourceId}-${p.dataset}`}>[{cite(p)}]</sup>
        ))}
      </p>
      {layer.metrics.length ? (
        <table className={styles.metrics}>
          <tbody>
            {layer.metrics.map((m) => (
              <tr key={m.key}>
                <th scope="row">{m.label}</th>
                <td className="num">{formatMetric(m.value, m.unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {layer.notes.length ? (
        <ul className={styles.notes}>
          {layer.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
