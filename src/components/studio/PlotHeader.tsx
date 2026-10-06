"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Check,
  CheckSquare,
  DownloadSimple,
  FileText,
  LinkSimple,
  Plus,
  Polygon,
  X,
} from "@phosphor-icons/react";
import { compareList } from "@/components/compare/compare-list";
import { COMPARE_LIMIT } from "@/lib/compare";
import { plotRef } from "@/lib/plot-list";
import { download, plotGeoJson, plotKml } from "@/lib/export";
import type { Plot } from "@/lib/contracts";
import { formatArea, formatLength, formatPlace } from "@/lib/format";
import { plotLocation, reportHref } from "@/lib/routes";
import styles from "./PlotHeader.module.css";

type Props = {
  plot: Plot;
  onClear: () => void;
  /** Composition mode: map clicks add or remove neighbouring parcels instead of replacing the plot. */
  composing: boolean;
  onCompose: () => void;
};

export function PlotHeader({ plot, onClear, composing, onCompose }: Props) {
  const parcelCount = plot.parcels?.length ?? 1;
  const [copied, setCopied] = useState(false);
  const compared = compareList.useList();
  const comparing = compared.some((p) => p.id === plot.id);

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
        <p className={styles.place}>{formatPlace(plot.municipality)}</p>
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
          {parcelCount > 1 ? "Particelle" : "Particella"} <span className="num">{plot.cadastral.parcel}</span>
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

      <button type="button" className={styles.compose} aria-pressed={composing} onClick={onCompose}>
        <Polygon size={15} aria-hidden="true" />
        {composing
          ? "Fatto: tocca le particelle da aggiungere o togliere"
          : parcelCount > 1
            ? `Lotto di ${parcelCount} particelle · modifica`
            : "Aggiungi particelle confinanti"}
      </button>

      <div className={styles.actions}>
        <Link href={reportHref(plot.id, plotLocation(plot))} className={styles.primary}>
          <FileText size={16} aria-hidden="true" /> Apri la scheda
        </Link>
        <button
          type="button"
          className={styles.secondary}
          aria-pressed={comparing}
          disabled={!comparing && compared.length >= COMPARE_LIMIT}
          title={
            !comparing && compared.length >= COMPARE_LIMIT
              ? `Puoi confrontare al massimo ${COMPARE_LIMIT} terreni`
              : undefined
          }
          onClick={() => (comparing ? compareList.remove(plot.id) : compareList.add(plotRef(plot)))}
        >
          {comparing ? <CheckSquare size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
          Confronta
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={copyLink}
          aria-label={copied ? "Link copiato" : "Copia il link a questo terreno"}
          title={copied ? "Link copiato" : "Copia link"}
        >
          {copied ? <Check size={16} aria-hidden="true" /> : <LinkSimple size={16} aria-hidden="true" />}
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
