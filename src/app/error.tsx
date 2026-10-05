"use client";

import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import styles from "./status-page.module.css";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={styles.page}>
      <LogoMark size={44} />
      <h1>Qualcosa si è interrotto.</h1>
      <p>La pagina non si è caricata correttamente. Riprova: se il problema resta, torna più tardi.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={reset}>
          Riprova
        </button>
        <Link href="/" className={styles.secondary}>
          Torna alla home
        </Link>
      </div>
    </main>
  );
}
