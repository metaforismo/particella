import type { Tone } from "./status";
import styles from "./StatusPill.module.css";

export function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={styles.pill} data-tone={tone}>
      {label}
    </span>
  );
}
