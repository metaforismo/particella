import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import styles from "./SiteHeader.module.css";

const NAV = [
  { href: "/#come-funziona", label: "Come funziona" },
  { href: "/#layer", label: "Cosa analizziamo" },
  { href: "/sviluppatori", label: "API" },
  { href: "/fonti", label: "Fonti" },
] as const;

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.home} aria-label="Particella, home">
          <Logo />
        </Link>

        <nav className={styles.nav} aria-label="Principale">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={styles.link}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <Link href="/studio" className={styles.cta}>
            Apri lo Studio
          </Link>
          <details className={styles.menu}>
            <summary className={styles.menuButton} aria-label="Menu">
              <span aria-hidden="true" />
            </summary>
            <nav className={styles.menuPanel} aria-label="Principale (mobile)">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
