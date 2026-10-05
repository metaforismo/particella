"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, FileText, LinkSimple, X } from "@phosphor-icons/react";
import type { Plot } from "@/lib/contracts";
import { formatArea, formatLength } from "@/lib/format";
import { reportHref } from "@/lib/routes";
import styles from "./PlotHeader.module.css";

export function PlotHeader({ plot, onClear }: { plot: Plot; onClear: () => void }) {
  const [copied, setCopied] = useState(false);
  const place = [plot.municipality?.name, plot.municipality?.provinceCode].filter(Boolean).join(" ");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked (permissions, insecure origin); the URL bar still has the link.
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <p className={styles.place}>{place || "Comune non identificato"}</p>
        <button type="button" className={styles.close} onClick={onClear} aria-label="Chiudi questo terreno">
          <X size={16} />
        </button>
      </div>

      <h1 className={styles.title}>
        Foglio <span className="num">{plot.cadastral.sheet}</span>
        <span className={styles.sep} aria-hidden="true" />
        Particella <span className="num">{plot.cadastral.parcel}</span>
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
          <dt>Sezione</dt>
          <dd>{plot.cadastral.section ?? "—"}</dd>
        </div>
      </dl>
      <p className={styles.measureNote}>
        Misure calcolate sul poligono della mappa catastale, non la superficie censuaria.
      </p>

      <div className={styles.actions}>
        <Link href={reportHref(plot.id)} className={styles.primary}>
          <FileText size={16} aria-hidden="true" /> Apri la scheda
        </Link>
        <button type="button" className={styles.secondary} onClick={copyLink} aria-live="polite">
          {copied ? <Check size={16} aria-hidden="true" /> : <LinkSimple size={16} aria-hidden="true" />}
          {copied ? "Link copiato" : "Copia link"}
        </button>
      </div>
    </header>
  );
}
