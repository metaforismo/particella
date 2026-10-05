import Link from "next/link";
import { ArrowUpRight, FilePdf, Quotes } from "@phosphor-icons/react/dist/ssr";
import styles from "./Products.module.css";

const API_SAMPLE = `GET /api/v1/plots/at?lat=45.4642&lon=9.1900

{
  "id": "it:F205:_:388:112",
  "cadastral": {
    "sheet": "388",
    "parcel": "112",
    "label": "Foglio 388 · Particella 112"
  },
  "areaM2": 1777.2,
  "provenance": [{
    "authority": "Agenzia delle Entrate",
    "license": "CC BY 4.0"
  }]
}`;

export function Products() {
  return (
    <section className={styles.section} aria-labelledby="products-title">
      <header className={styles.header}>
        <h2 id="products-title" className={styles.title}>
          Tre modi per usare gli stessi dati.
        </h2>
        <p>
          Dall&apos;esplorazione libera al documento da allegare, fino all&apos;integrazione nel tuo software.
        </p>
      </header>

      <article className={styles.studio}>
        <div className={styles.studioCopy}>
          <h3>Studio</h3>
          <p className={styles.claim}>Chiedi al terreno.</p>
          <p>
            Mappa, livelli e documenti di piano nello stesso spazio. Fai una domanda in italiano:
            l&apos;assistente risponde solo con quello che trova nelle fonti e ti porta all&apos;articolo
            esatto delle norme.
          </p>
          <Link href="/studio" className={styles.link}>
            Apri lo Studio <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <figure className={styles.chat} aria-label="Esempio di conversazione nello Studio">
          <p className={styles.ask}>Posso costruire una bifamiliare su questo lotto?</p>
          <div className={styles.answer}>
            <p>
              Il lotto ricade in zona residenziale di completamento. Le norme ammettono nuove abitazioni con
              un indice fondiario massimo e un&apos;altezza limite, che trovi all&apos;articolo citato.
            </p>
            <p>
              Una parte del confine sud tocca un&apos;area a pericolosità idraulica bassa: non vieta di
              costruire, ma può richiedere accorgimenti progettuali.
            </p>
            <ul className={styles.cites}>
              <li>
                <Quotes size={12} weight="fill" aria-hidden="true" /> Norme tecniche, art. 23
              </li>
              <li>
                <Quotes size={12} weight="fill" aria-hidden="true" /> ISPRA, mosaicatura P1
              </li>
            </ul>
          </div>
          <figcaption className={styles.caption}>Esempio illustrativo</figcaption>
        </figure>
      </article>

      <div className={styles.pair}>
        <article id="scheda" className={styles.report}>
          <div className={styles.sheets} aria-hidden="true">
            <span />
            <span />
            <span>
              <FilePdf size={22} />
              <i />
              <i />
              <i />
            </span>
          </div>
          <h3>Scheda del lotto</h3>
          <p className={styles.claim}>Tutto il terreno in una pagina.</p>
          <p>
            Superficie, zona di piano, vincoli, rischi e contesto, con mappe e fonti. Da consultare online o
            scaricare in PDF per un cliente, una banca o un notaio.
          </p>
        </article>

        <article className={styles.api}>
          <h3>API</h3>
          <p className={styles.claim}>Gli stessi dati, nel tuo prodotto.</p>
          <p>Risposte JSON stabili, con unità esplicite e la provenienza di ogni campo.</p>
          <pre className={styles.code} tabIndex={0} aria-label="Esempio di risposta API">
            <code>{API_SAMPLE}</code>
          </pre>
          <Link href="/sviluppatori" className={styles.link}>
            Documentazione API <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </article>
      </div>
    </section>
  );
}
