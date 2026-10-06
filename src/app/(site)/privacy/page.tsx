import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Quali dati usa Particella, dove restano e a chi vengono inviati.",
};

export default function PrivacyPage() {
  return (
    <article className={styles.page}>
      <h1>Privacy</h1>
      <p className={styles.lede}>
        Particella si usa senza registrazione. Questa pagina descrive in modo semplice quali dati passano dal
        servizio e dove finiscono.
      </p>

      <section>
        <h2>Cosa resta nel tuo browser</h2>
        <p>
          I terreni visti di recente, quelli messi a confronto, l&apos;intestazione dello studio e le note del
          tecnico sulla scheda sono salvati solo nel tuo browser (archiviazione locale). Non vengono inviati
          ai nostri server e puoi cancellarli in qualsiasi momento dalle impostazioni del browser o con il
          pulsante &ldquo;Cancella&rdquo; nello Studio.
        </p>
      </section>

      <section>
        <h2>Cosa riceve il nostro server</h2>
        <p>
          Per analizzare un terreno il server riceve il punto scelto sulla mappa o il testo cercato, e
          l&apos;identificativo catastale del lotto. Usiamo questi dati solo per interrogare le fonti
          pubbliche e restituirti la risposta. Le risposte delle fonti possono essere conservate per un tempo
          limitato per non sovraccaricarle.
        </p>
        <p>
          Per proteggere il servizio da abusi teniamo per breve tempo un contatore delle richieste per
          indirizzo di rete. I registri applicativi riportano le posizioni in forma approssimata; i registri
          della piattaforma di hosting (Vercel) possono contenere gli indirizzi completi delle richieste e
          sono conservati dal fornitore per un periodo limitato.
        </p>
      </section>

      <section>
        <h2>Fonti pubbliche e servizi esterni</h2>
        <p>
          Per rispondere interroghiamo enti pubblici e servizi di dati aperti elencati nella pagina{" "}
          <Link href="/fonti">Fonti e licenze</Link>. Ricevono le coordinate o l&apos;area del terreno, non
          dati che ti identificano. La mappa di sfondo è fornita da OpenFreeMap.
        </p>
      </section>

      <section>
        <h2>Assistente &ldquo;Chiedi al terreno&rdquo;</h2>
        <p>
          Le domande che scrivi all&apos;assistente e i dati del terreno necessari a rispondere vengono
          inviati a un fornitore di modelli di intelligenza artificiale tramite Vercel AI Gateway. Non
          scrivere nell&apos;assistente dati personali tuoi o di altre persone.
        </p>
      </section>

      <section>
        <h2>Statistiche di utilizzo</h2>
        <p>
          Misuriamo visite e prestazioni delle pagine con Vercel Web Analytics e Speed Insights, in forma
          aggregata e senza cookie.
        </p>
      </section>

      <section>
        <h2>Titolare e contatti</h2>
        <p className={styles.pending}>
          Dati del titolare del trattamento e recapito per esercitare i diritti previsti dal GDPR: in
          aggiornamento prima del lancio pubblico.
        </p>
      </section>
    </article>
  );
}
