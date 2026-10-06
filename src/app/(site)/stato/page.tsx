import type { Metadata } from "next";
import { SourceStatusBoard } from "@/components/status/SourceStatusBoard";
import { sources } from "@/server/core/sources";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Stato delle fonti",
  description: "Come stanno rispondendo in questo momento le fonti pubbliche interrogate da Particella.",
};

export default function StatusPage() {
  // Names come from the registry on the server; live states are polled in the browser.
  // Candidate and legend entries are registered but never queried: only sources in use are shown.
  const inUse = sources.filter((s) => !/-(candidate|status|legend)$/.test(s.id));
  const names = Object.fromEntries(inUse.map((s) => [s.id, { name: s.name, authority: s.authority }]));
  return (
    <div className={styles.page}>
      <h1>Stato delle fonti</h1>
      <p className={styles.lede}>
        Particella dipende da servizi pubblici che a volte rallentano o non rispondono. Qui vedi come si sono
        comportati nelle ultime richieste reali; quando una fonte ha problemi, i livelli che la usano lo
        dicono.
      </p>
      <SourceStatusBoard names={names} />
    </div>
  );
}
