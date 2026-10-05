import styles from "./Audiences.module.css";

const AUDIENCES = [
  {
    who: "Sviluppatori di impianti fotovoltaici",
    what: "Per ogni terreno candidato: distanza dalla rete ad alta tensione, pendenza, irraggiamento e vincoli, poi il confronto fianco a fianco.",
  },
  {
    who: "Sviluppatori immobiliari",
    what: "Scarta in pochi minuti i lotti che non reggono e confronta quelli che restano sugli stessi criteri.",
  },
  {
    who: "Architetti, ingegneri e geometri",
    what: "Parti dallo studio di fattibilità con vincoli e norme già raccolti, e verifica ogni dato alla fonte.",
  },
  {
    who: "Banche e periti",
    what: "Allega alla valutazione una scheda con rischi e destinazione urbanistica, sempre datata e riproducibile.",
  },
  {
    who: "Agenti immobiliari",
    what: "Rispondi con dati ufficiali alle domande su un terreno in vendita e condividi la scheda con l'acquirente.",
  },
  {
    who: "Chi compra o eredita un terreno",
    what: "Capisci cosa hai tra le mani prima di parlare con un tecnico, con le domande giuste già pronte.",
  },
];

export function Audiences() {
  return (
    <section className={styles.section} aria-labelledby="aud-title">
      <h2 id="aud-title" className={styles.title}>
        Per chi decide su un terreno.
      </h2>
      <dl className={styles.list}>
        {AUDIENCES.map((a) => (
          <div key={a.who} className={styles.item}>
            <dt>{a.who}</dt>
            <dd>{a.what}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
