"use client";

import { useRouter } from "next/navigation";
import { PlaceSearch } from "@/components/search/PlaceSearch";
import { studioHref } from "@/lib/routes";
import styles from "./FinalCta.module.css";

export function FinalCta() {
  const router = useRouter();
  return (
    <section className={styles.band} aria-labelledby="cta-title">
      <div className={styles.inner}>
        <h2 id="cta-title" className={styles.title}>
          Prova con un terreno che conosci.
        </h2>
        <p>Il tuo giardino, il lotto accanto, il terreno del nonno. Vedrai subito cosa sappiamo e cosa no.</p>
        <div className={styles.search}>
          <PlaceSearch onSelect={(place) => router.push(studioHref(place))} />
        </div>
      </div>
    </section>
  );
}
