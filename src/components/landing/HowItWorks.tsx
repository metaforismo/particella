import styles from "./HowItWorks.module.css";

const STEPS = [
  {
    title: "Indica il terreno",
    body: "Cerca un indirizzo, tocca la mappa o usa la tua posizione. Troviamo la particella catastale e il suo confine.",
  },
  {
    title: "Incrociamo le fonti",
    body: "Per quel confine interroghiamo catasto, piani, vincoli, rischi e servizi. Di ogni risposta conserviamo ente, licenza e data.",
  },
  {
    title: "Leggi e chiedi",
    body: "Una scheda con le risposte essenziali e un assistente che risponde sulle norme, rimandando al punto esatto del documento.",
  },
];

export function HowItWorks() {
  return (
    <section id="come-funziona" className={styles.section} aria-labelledby="how-title">
      <h2 id="how-title" className={styles.title}>
        Dal confine alla risposta in meno di un minuto.
      </h2>
      <ol className={styles.steps}>
        {STEPS.map((step, index) => (
          <li key={step.title} className={styles.step}>
            <span className={styles.index} aria-hidden="true">
              {index + 1}
            </span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
