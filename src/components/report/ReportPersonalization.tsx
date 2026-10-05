"use client";

import { useEffect, useId, useState } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import styles from "./ReportPersonalization.module.css";

type Studio = { name: string; author: string };

const STUDIO_KEY = "particella:report-studio";
const notesKey = (plotId: string) => `particella:report-notes:${plotId}`;

/** Storage may be unavailable (private mode): the fields still work for this page view. */
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/**
 * A professional's own header and notes on the printed report. Entered by the user, kept only in
 * this browser, and printed exactly as typed: Particella never fills these fields.
 */
export function ReportPersonalization({ plotId }: { plotId: string }) {
  const [studio, setStudio] = useState<Studio>({ name: "", author: "" });
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const notesId = useId();

  useEffect(() => {
    // Read after mount so server and client render the same empty state first.
    const stored = load<Studio>(STUDIO_KEY, { name: "", author: "" });
    const storedNotes = load<string>(notesKey(plotId), "");
    queueMicrotask(() => {
      setStudio(stored);
      setNotes(storedNotes);
    });
  }, [plotId]);

  const update = (next: Studio) => {
    setStudio(next);
    save(STUDIO_KEY, next);
  };

  const hasHeader = Boolean(studio.name || studio.author);

  return (
    <section className={styles.block} aria-label="Personalizzazione della scheda">
      {hasHeader && !editing ? (
        <p className={styles.preparedBy}>
          Preparata da {[studio.author, studio.name].filter(Boolean).join(", ")}
        </p>
      ) : null}

      <button
        type="button"
        className={styles.toggle}
        onClick={() => setEditing((v) => !v)}
        aria-expanded={editing}
      >
        <PencilSimple size={14} aria-hidden="true" />
        {editing
          ? "Fatto"
          : hasHeader || notes
            ? "Modifica intestazione e note"
            : "Aggiungi intestazione e note"}
      </button>

      {editing ? (
        <div className={styles.form}>
          <label>
            Studio o società
            <input
              value={studio.name}
              maxLength={80}
              autoComplete="organization"
              onChange={(e) => update({ ...studio, name: e.target.value })}
              placeholder="Es. Studio tecnico Rossi…"
            />
          </label>
          <label>
            Tecnico
            <input
              value={studio.author}
              maxLength={80}
              autoComplete="name"
              onChange={(e) => update({ ...studio, author: e.target.value })}
              placeholder="Es. Geom. Maria Rossi…"
            />
          </label>
          <p className={styles.hint}>L&apos;intestazione resta salvata solo in questo browser.</p>
        </div>
      ) : null}

      {editing || notes ? (
        <div className={styles.notes}>
          <label htmlFor={notesId}>Note del tecnico</label>
          {editing ? (
            <textarea
              id={notesId}
              value={notes}
              maxLength={2000}
              rows={4}
              onChange={(e) => {
                setNotes(e.target.value);
                save(notesKey(plotId), e.target.value);
              }}
              placeholder="Osservazioni, verifiche da fare, accordi con il cliente…"
            />
          ) : (
            <p id={notesId}>{notes}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
