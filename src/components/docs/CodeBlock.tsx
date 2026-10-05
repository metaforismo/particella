"use client";

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import styles from "./CodeBlock.module.css";

export function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked: the code is still selectable.
    }
  };

  return (
    <figure className={styles.block}>
      <figcaption className={styles.bar}>
        <span>{label}</span>
        <button type="button" onClick={copy} aria-live="polite">
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? "Copiato" : "Copia"}
        </button>
      </figcaption>
      <pre tabIndex={0}>
        <code>{code}</code>
      </pre>
    </figure>
  );
}
