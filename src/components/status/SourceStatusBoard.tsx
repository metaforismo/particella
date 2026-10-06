"use client";

import { useEffect, useState } from "react";
import { StatusPill } from "@/components/studio/StatusPill";
import type { Tone } from "@/components/studio/status";
import { api } from "@/lib/api/client";
import type { SourceStatus } from "@/lib/contracts";
import { formatNumber } from "@/lib/format";
import styles from "./SourceStatusBoard.module.css";

type Names = Record<string, { name: string; authority: string }>;

const REFRESH_MS = 60_000;

const STATE: Record<SourceStatus["state"], { tone: Tone; label: string }> = {
  ok: { tone: "none", label: "Risponde" },
  slow: { tone: "medium", label: "Lenta" },
  error: { tone: "high", label: "Con errori" },
  unknown: { tone: "unknown", label: "Nessuna richiesta recente" },
};

function ago(iso: string | null) {
  if (!iso) return "—";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "meno di un minuto fa";
  if (minutes < 60) return `${minutes} min fa`;
  return `${Math.round(minutes / 60)} h fa`;
}

export function SourceStatusBoard({ names }: { names: Names }) {
  const [rows, setRows] = useState<SourceStatus[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = () =>
      api
        .status(controller.signal)
        .then((data) => {
          setRows(data);
          setFailed(false);
        })
        .catch((error: unknown) => {
          if ((error as Error).name !== "AbortError") setFailed(true);
        });
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, []);

  if (failed && !rows)
    return <p className={styles.note}>Lo stato delle fonti non è disponibile in questo momento.</p>;
  if (!rows) return <p className={styles.note}>Lettura dello stato…</p>;

  const order: SourceStatus["state"][] = ["error", "slow", "ok", "unknown"];
  const sorted = rows
    .filter((r) => names[r.sourceId])
    .sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state));
  const instanceOnly = rows.some((r) => r.scope === "instance");

  return (
    <>
      <ul className={styles.list} aria-live="polite">
        {sorted.map((row) => {
          const meta = names[row.sourceId];
          const { tone, label } = STATE[row.state];
          return (
            <li key={row.sourceId} className={styles.row}>
              <div>
                <p className={styles.authority}>{meta?.authority ?? row.provenance.authority}</p>
                <p className={styles.name}>{meta?.name ?? row.provenance.dataset}</p>
              </div>
              <StatusPill tone={tone} label={label} />
              <p className={styles.metric}>
                {row.medianLatencyMs != null ? (
                  <>
                    <span className="num">{formatNumber(row.medianLatencyMs / 1000, 1)} s</span> tempo tipico
                  </>
                ) : (
                  "—"
                )}
              </p>
              <p className={styles.metric}>{ago(row.checkedAt)}</p>
            </li>
          );
        })}
      </ul>
      <p className={styles.note}>
        Aggiornato ogni minuto dalle richieste reali degli utenti; nessun controllo automatico sovraccarica le
        fonti.
        {instanceOnly ? " Alcuni valori riguardano solo il server che ha risposto a questa pagina." : ""}
      </p>
    </>
  );
}
