import { LogoMark } from "@/components/brand/Logo";
import styles from "@/app/status-page.module.css";

export default function Loading() {
  return (
    <main className={styles.page} aria-busy="true">
      <LogoMark size={44} />
      <h1>Preparazione della scheda del terreno…</h1>
      <p>
        Lettura di catasto, piani, rischi e contesto dalle fonti pubbliche. Di solito servono pochi secondi.
      </p>
    </main>
  );
}
