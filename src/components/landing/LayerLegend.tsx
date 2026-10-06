import Link from "next/link";
import { LegendSwatch } from "@/components/legend/LegendSwatch";
import { GROUP_LABEL, LAYERS } from "@/content/layers";
import type { LayerGroup } from "@/lib/contracts";
import styles from "./LayerLegend.module.css";

const GROUPS = Object.keys(GROUP_LABEL) as LayerGroup[];

export function LayerLegend() {
  return (
    <section id="layer" className={styles.section} aria-labelledby="legend-title">
      <div className={styles.intro}>
        <h2 id="legend-title" className={styles.title}>
          Cosa leggiamo per ogni terreno.
        </h2>
        <p>
          {LAYERS.length} livelli da enti pubblici e dataset aperti. La copertura dei piani urbanistici
          dipende dalla Regione: <Link href="/fonti#copertura">ecco dove arriva oggi</Link>. Quando un dato
          manca lo diciamo, non lo stimiamo.
        </p>
      </div>

      <div className={styles.sheet}>
        <p className={styles.sheetTitle}>Legenda</p>
        <div className={styles.groups}>
          {GROUPS.map((group) => (
            <div key={group} className={styles.group}>
              <h3>{GROUP_LABEL[group]}</h3>
              <ul>
                {LAYERS.filter((l) => l.group === group).map((layer) => (
                  <li key={layer.id} className={styles.item}>
                    <LegendSwatch symbol={layer.symbol} tone={layer.tone} />
                    <div>
                      <strong>{layer.title}</strong>
                      <p>{layer.question}</p>
                      <span>{layer.authority}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
