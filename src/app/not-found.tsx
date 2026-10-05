import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import styles from "./status-page.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <LogoMark size={44} />
      <h1>Questa pagina non è sulla mappa.</h1>
      <p>L&apos;indirizzo potrebbe essere sbagliato o la pagina è stata spostata.</p>
      <div className={styles.actions}>
        <Link href="/studio" className={styles.primary}>
          Apri lo Studio
        </Link>
        <Link href="/" className={styles.secondary}>
          Torna alla home
        </Link>
      </div>
    </main>
  );
}
