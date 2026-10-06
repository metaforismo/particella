import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Logo />
          <p>
            Dati pubblici ufficiali, letti per chi deve decidere su un terreno. Ogni valore porta con sé la
            sua fonte e la data in cui l&apos;abbiamo letto.
          </p>
        </div>

        <nav className={styles.cols} aria-label="Piè di pagina">
          <div>
            <h2>Prodotto</h2>
            <Link href="/studio">Studio</Link>
            <Link href="/#scheda">Scheda del lotto</Link>
            <Link href="/sviluppatori">API</Link>
          </div>
          <div>
            <h2>Trasparenza</h2>
            <Link href="/fonti">Fonti e licenze</Link>
            <Link href="/fonti#limiti">Limiti dei dati</Link>
            <Link href="/stato">Stato delle fonti</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/condizioni">Condizioni d&apos;uso</Link>
          </div>
        </nav>
      </div>

      <p className={styles.legal}>
        Particella non sostituisce il certificato di destinazione urbanistica né il parere di un tecnico
        abilitato. Le informazioni hanno valore orientativo.
      </p>
    </footer>
  );
}
