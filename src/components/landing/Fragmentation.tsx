import { LogoMark } from "@/components/brand/Logo";
import styles from "./Fragmentation.module.css";

const PORTALS = [
  { name: "Catasto", owner: "Agenzia delle Entrate" },
  { name: "Piano regolatore", owner: "Geoportale regionale" },
  { name: "Norme tecniche", owner: "PDF del Comune" },
  { name: "Frane e alluvioni", owner: "ISPRA IdroGEO" },
  { name: "Zone sismiche", owner: "Protezione Civile" },
  { name: "Natura 2000", owner: "Ministero dell'Ambiente" },
  { name: "Vincoli paesaggistici", owner: "Ministero della Cultura" },
  { name: "Popolazione", owner: "ISTAT" },
];

const ROW = 44;
const HEIGHT = PORTALS.length * ROW;

export function Fragmentation() {
  return (
    <section className={styles.section} aria-labelledby="frag-title">
      <div className={styles.copy}>
        <h2 id="frag-title" className={styles.title}>
          Un terreno, otto portali diversi.
        </h2>
        <p>
          Per capire cosa si può fare su un lotto oggi si apre il visualizzatore catastale, poi il geoportale
          della Regione, poi il PDF delle norme tecniche, poi le mappe di pericolosità, sperando che i confini
          coincidano.
        </p>
        <p>
          Particella interroga tutte le fonti nello stesso momento e le riporta sullo stesso confine. Tu leggi
          una scheda sola, e ogni riga ti dice da dove viene.
        </p>
      </div>

      <div className={styles.diagram} aria-hidden="true">
        <ul className={styles.portals} style={{ height: HEIGHT }}>
          {PORTALS.map((p) => (
            <li key={p.name} style={{ height: ROW }}>
              <span className={styles.portalName}>{p.name}</span>
              <span className={styles.portalOwner}>{p.owner}</span>
            </li>
          ))}
        </ul>

        <svg
          className={styles.wires}
          viewBox={`0 0 100 ${HEIGHT}`}
          preserveAspectRatio="none"
          style={{ height: HEIGHT }}
        >
          {PORTALS.map((p, i) => {
            const y = i * ROW + ROW / 2;
            const mid = HEIGHT / 2;
            return (
              <path
                key={p.name}
                d={`M0 ${y} C 55 ${y}, 45 ${mid}, 100 ${mid}`}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        <div className={styles.result}>
          <LogoMark size={56} />
          <strong>Una scheda</strong>
          <span>con la fonte su ogni riga</span>
        </div>
      </div>
    </section>
  );
}
