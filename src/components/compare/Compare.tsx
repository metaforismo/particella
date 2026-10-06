"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowSquareOut, X } from "@phosphor-icons/react";
import { LegendSwatch } from "@/components/legend/LegendSwatch";
import { StatusPill } from "@/components/studio/StatusPill";
import { resultLabel } from "@/components/studio/status";
import { GROUP_LABEL, LAYERS } from "@/content/layers";
import { ApiRequestError, api } from "@/lib/api/client";
import type { LayerGroup, PlotReport } from "@/lib/contracts";
import { formatArea, formatMetric } from "@/lib/format";
import { compareHref } from "@/lib/compare";
import { formatLocation, type PlotLocation } from "@/lib/routes";
import { compareList } from "./compare-list";
import styles from "./Compare.module.css";

export type CompareTarget = { id: string; at?: PlotLocation };

type Column =
  | { status: "loading"; target: CompareTarget }
  | { status: "ready"; target: CompareTarget; report: PlotReport }
  | { status: "failed"; target: CompareTarget; message: string };

const GROUPS = Object.keys(GROUP_LABEL) as LayerGroup[];

export function Compare({ targets }: { targets: CompareTarget[] }) {
  const [columns, setColumns] = useState<Column[]>(() =>
    targets.map((target) => ({ status: "loading", target })),
  );

  useEffect(() => {
    const controller = new AbortController();
    targets.forEach((target, index) => {
      api
        .report(target.id, target.at, controller.signal)
        .then((report) =>
          setColumns((cols) => cols.map((c, i) => (i === index ? { status: "ready", target, report } : c))),
        )
        .catch((error: unknown) => {
          if ((error as Error).name === "AbortError") return;
          const message =
            error instanceof ApiRequestError ? error.message : "Il terreno non è stato caricato. Riprova.";
          setColumns((cols) => cols.map((c, i) => (i === index ? { status: "failed", target, message } : c)));
        });
    });
    return () => controller.abort();
  }, [targets]);

  const router = useRouter();
  const remove = (id: string) => {
    compareList.remove(id);
    router.replace(compareHref(targets.filter((t) => t.id !== id)));
  };

  if (!targets.length) {
    return (
      <div className={styles.empty}>
        <h1>Confronta terreni</h1>
        <p>
          Aggiungi fino a quattro terreni dallo Studio con &ldquo;Confronta&rdquo; e ritrovali qui affiancati,
          livello per livello.
        </p>
        <Link href="/studio" className={styles.primary}>
          Apri lo Studio
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Confronta terreni</h1>
        <p>
          Gli stessi livelli, letti dalle stesse fonti, per ogni terreno. Ogni cella rimanda al dettaglio.
        </p>
      </header>

      <div className={styles.scroller} role="region" aria-label="Tabella di confronto" tabIndex={0}>
        <table className={styles.table} style={{ "--cols": columns.length } as React.CSSProperties}>
          <thead>
            <tr>
              <th scope="col" className={styles.corner}>
                <span className="visually-hidden">Livello</span>
              </th>
              {columns.map((col) => (
                <th key={col.target.id} scope="col" className={styles.plotHead}>
                  <PlotHeading column={col} onRemove={() => remove(col.target.id)} />
                </th>
              ))}
            </tr>
          </thead>
          {GROUPS.map((group) => (
            <tbody key={group}>
              <tr className={styles.groupRow}>
                <th scope="colgroup" colSpan={columns.length + 1}>
                  {GROUP_LABEL[group]}
                </th>
              </tr>
              {LAYERS.filter((l) => l.group === group).map((meta) => (
                <tr key={meta.id}>
                  <th scope="row" className={styles.layerHead}>
                    <LegendSwatch symbol={meta.symbol} tone={meta.tone} size={14} />
                    {meta.title}
                  </th>
                  {columns.map((col) => {
                    if (col.status !== "ready") {
                      return (
                        <td key={col.target.id} className={styles.cell} data-state={col.status}>
                          {col.status === "loading" ? <span className={styles.skeleton} /> : "—"}
                        </td>
                      );
                    }
                    const result = col.report.layers.find((l) => l.layer === meta.id);
                    if (!result) {
                      return (
                        <td key={col.target.id} className={styles.cell}>
                          <StatusPill tone="unknown" label="Non disponibile" />
                        </td>
                      );
                    }
                    const { tone, label } = resultLabel(result);
                    const lead = result.metrics[0];
                    return (
                      <td key={col.target.id} className={styles.cell}>
                        <StatusPill tone={tone} label={label} />
                        {lead && lead.value != null ? (
                          <span className={styles.metric}>
                            <span>{lead.label}</span>
                            <strong className="num">{formatMetric(lead.value, lead.unit)}</strong>
                          </span>
                        ) : null}
                        <span className={styles.headline}>{result.headline}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className={styles.note}>
        Valori orientativi letti dalle fonti pubbliche indicate in ogni scheda. Non sostituiscono il
        certificato di destinazione urbanistica né il parere di un tecnico abilitato.
      </p>
    </div>
  );
}

function PlotHeading({ column, onRemove }: { column: Column; onRemove: () => void }) {
  const { target } = column;
  const studio = `/studio?plot=${encodeURIComponent(target.id)}${target.at ? `&at=${formatLocation(target.at)}` : ""}`;
  return (
    <div className={styles.heading}>
      <button type="button" className={styles.remove} onClick={onRemove} aria-label="Togli dal confronto">
        <X size={14} />
      </button>
      {column.status === "ready" ? (
        <>
          <span className={styles.place}>{column.report.plot.municipality?.name ?? "Comune"}</span>
          <strong translate="no">{column.report.plot.cadastral.label}</strong>
          <span className={styles.area}>{formatArea(column.report.plot.areaM2)}</span>
        </>
      ) : column.status === "failed" ? (
        <>
          <strong translate="no">{target.id}</strong>
          <span className={styles.failed}>{column.message}</span>
        </>
      ) : (
        <>
          <span className={styles.skeleton} style={{ width: "50%" }} />
          <span className={styles.skeleton} style={{ width: "80%", height: "1.1rem" }} />
        </>
      )}
      <Link href={studio} className={styles.open}>
        Apri nello Studio <ArrowSquareOut size={13} aria-hidden="true" />
      </Link>
    </div>
  );
}
