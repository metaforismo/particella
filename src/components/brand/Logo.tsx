import styles from "./Logo.module.css";

type Props = {
  /** Hide the wordmark and keep only the parcel glyph. */
  compact?: boolean;
  className?: string;
};

/** An irregular cadastral parcel with survey hatching and a benchmark point. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={styles.mark}
    >
      <defs>
        <pattern
          id="particella-hatch"
          width="3.2"
          height="3.2"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="1.3" height="3.2" fill="var(--cantiere)" />
        </pattern>
      </defs>
      <path d="M3.5 7.2 13.8 2.8l6.9 6.1-2.4 11.4-12.6 1.2Z" fill="url(#particella-hatch)" />
      <path
        d="M3.5 7.2 13.8 2.8l6.9 6.1-2.4 11.4-12.6 1.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="11.6" cy="12.6" r="1.9" fill="currentColor" />
    </svg>
  );
}

export function Logo({ compact = false, className }: Props) {
  return (
    <span className={[styles.logo, className].filter(Boolean).join(" ")}>
      <LogoMark />
      {compact ? (
        <span className="visually-hidden">Particella</span>
      ) : (
        <span className={styles.word}>Particella</span>
      )}
    </span>
  );
}
