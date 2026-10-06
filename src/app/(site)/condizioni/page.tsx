import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Condizioni d'uso",
  description: "Come usare Particella e cosa significano le sue informazioni.",
};

export default function TermsPage() {
  return (
    <article className={styles.page}>
      <h1>Condizioni d&apos;uso</h1>
      <p className={styles.lede}>
        Particella raccoglie e mette a confronto dati pubblici sui terreni. Usandola accetti queste
        condizioni.
      </p>

      <section>
        <h2>Valore orientativo</h2>
        <p>
          Le informazioni hanno valore orientativo. Non sostituiscono il certificato di destinazione
          urbanistica, le verifiche presso gli uffici competenti, le visure ufficiali né il parere di un
          tecnico abilitato. Prima di comprare, vendere, progettare o costruire verifica sempre presso il
          Comune e gli enti competenti.
        </p>
      </section>

      <section>
        <h2>Dati delle fonti</h2>
        <p>
          I dati restano dei rispettivi titolari e sono usati secondo le loro licenze, indicate accanto a ogni
          valore e nella pagina <Link href="/fonti">Fonti e licenze</Link>. Le fonti possono essere
          incomplete, non aggiornate o temporaneamente non disponibili: in quei casi lo segnaliamo, ma un dato
          mancante non indica l&apos;assenza di vincoli.
        </p>
        <p>
          Se riusi i dati ottenuti da Particella, rispetta le licenze originali: per esempio
          l&apos;attribuzione richiesta dalle licenze Creative Commons e l&apos;obbligo di condivisione allo
          stesso modo per i dati CC BY-SA e ODbL.
        </p>
      </section>

      <section>
        <h2>Assistente</h2>
        <p>
          Le risposte dell&apos;assistente sono generate automaticamente dai dati raccolti e possono contenere
          errori. Controlla sempre le fonti citate.
        </p>
      </section>

      <section>
        <h2>Uso corretto</h2>
        <p>
          Non usare il servizio per scaricare dati in massa, aggirare i limiti di utilizzo o sovraccaricare le
          fonti pubbliche. Per integrazioni e volumi elevati usa l&apos;API secondo quanto descritto nella
          pagina per sviluppatori.
        </p>
      </section>

      <section>
        <h2>Beta</h2>
        <p>Il servizio è in versione beta: funzioni, copertura e limiti possono cambiare senza preavviso.</p>
      </section>
    </article>
  );
}
