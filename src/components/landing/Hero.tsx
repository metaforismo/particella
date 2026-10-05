"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlaceSearch } from "@/components/search/PlaceSearch";
import { LegendSwatch } from "@/components/legend/LegendSwatch";
import { EXAMPLES } from "@/content/examples";
import { LAYER_BY_ID } from "@/content/layers";
import type { HeroExample } from "@/content/hero-example";
import { studioHref } from "@/lib/routes";
import { HeroMap } from "./HeroMap";
import styles from "./Hero.module.css";

export function Hero({ example }: { example: HeroExample }) {
  const router = useRouter();
  const [arrived, setArrived] = useState(false);

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.copy}>
        <h1 id="hero-title" className={styles.title}>
          Cosa si può costruire qui?
        </h1>
        <p className={styles.lede}>
          Scegli un terreno ovunque in Italia. Leggiamo catasto, piano urbanistico, vincoli e rischi dalle
          fonti pubbliche ufficiali e ti rispondiamo citando ogni documento.
        </p>
        <div className={styles.search}>
          <PlaceSearch onSelect={(place) => router.push(studioHref(place))} />
        </div>
        <p className={styles.note}>
          Prova con{" "}
          {EXAMPLES.slice(0, 3).map((ex, i) => (
            <span key={ex.short}>
              <Link href={`/studio?lat=${ex.point.lat}&lon=${ex.point.lon}`}>{ex.short}</Link>
              {i < 2 ? ", " : ". "}
            </span>
          ))}
          Gratis durante la beta, senza registrazione.
        </p>
      </div>

      <figure className={styles.stage}>
        <HeroMap geometry={example.plot.geometry} onArrive={() => setArrived(true)} />

        <figcaption className={styles.card} data-arrived={arrived || undefined}>
          <div className={styles.cardHead}>
            <span className={styles.cardKicker}>{example.plot.municipality}</span>
            <strong className={styles.cardTitle}>{example.plot.label}</strong>
            <span className={styles.cardArea}>
              <span className="num">{example.plot.area}</span> di superficie catastale
            </span>
          </div>
          <ul className={styles.rows}>
            {example.rows.map((row, index) => {
              const meta = LAYER_BY_ID[row.layer];
              return (
                <li key={row.layer} className={styles.row} style={{ "--i": index } as React.CSSProperties}>
                  <LegendSwatch symbol={meta.symbol} tone={meta.tone} size={14} />
                  <span className={styles.rowLabel}>{meta.title}</span>
                  <span className={styles.rowValue}>{row.value}</span>
                  <span className={styles.rowSource}>{row.source}</span>
                </li>
              );
            })}
          </ul>
        </figcaption>
      </figure>
    </section>
  );
}
