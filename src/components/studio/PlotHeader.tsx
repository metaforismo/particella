"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, DownloadSimple, FileText, LinkSimple, X } from "@phosphor-icons/react";
import { download, plotGeoJson, plotKml } from "@/lib/export";
import type { Plot } from "@/lib/contracts";
import { formatArea, formatLength } from "@/lib/format";
import { reportHref } from "@/lib/routes";
import styles from "./PlotHeader.module.css";

export function PlotHeader({ plot, onClear }: { plot: Plot; onClear: () => void }) {
  const [copied, setCopied] = useState(false);
  const m = plot.municipality;
  // provinceCode may be the ISTAT number; only a two-letter sigla reads naturally after the name.
  const sigla = m?.provinceCode && /^[A-Z]{2}$/.test(m.provinceCode) ? `(${m.provinceCode})` : null;
  const place = [m?.name, sigla ?? m?.region].filter(Boolean).join(sigla ? " " : ", ");

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

      <h1 className={styles.title} translate="no">
        <span>
          Foglio <span className="num">{plot.cadastral.sheet}</span>
        </span>
        <span className={styles.sep} aria-hidden="true" />
        <span>
          Particella <span className="num">{plot.cadastral.parcel}</span>
        </span>
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
        <Link href={reportHref(plot.id, plot.centroid)} className={styles.primary}>
          <FileText size={16} aria-hidden="true" /> Apri la scheda
        </Link>
        <button type="button" className={styles.secondary} onClick={copyLink} aria-live="polite">
          {copied ? <Check size={16} aria-hidden="true" /> : <LinkSimple size={16} aria-hidden="true" />}
          {copied ? "Link copiato" : "Copia link"}
        </button>
        {plot.geometry ? (
          <details className={styles.menu}>
            <summary className={styles.secondary} aria-label="Scarica il confine del lotto">
              <DownloadSimple size={16} aria-hidden="true" />
            </summary>
            <div className={styles.menuPanel}>
              <p>Scarica il confine</p>
              <button type="button" onClick={() => download(plotGeoJson(plot))}>
                GeoJSON <span>per QGIS e software GIS</span>
              </button>
              <button type="button" onClick={() => download(plotKml(plot))}>
                KML <span>per Google Earth</span>
              </button>
            </div>
          </details>
        ) : null}
      </div>
    </header>
  );
}
