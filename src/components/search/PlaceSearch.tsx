"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MagnifyingGlass, MapPin, CircleNotch } from "@phosphor-icons/react";
import type { GeocodeResult } from "@/lib/contracts";
import { useGeocode } from "./useGeocode";
import styles from "./PlaceSearch.module.css";

type Props = {
  /** Called with the chosen place, or with the raw query when nothing was picked. */
  onSelect: (place: GeocodeResult | { query: string }) => void;
  size?: "large" | "compact";
  submitLabel?: string;
  autoFocus?: boolean;
  defaultValue?: string;
};

export function PlaceSearch({
  onSelect,
  size = "large",
  submitLabel = "Analizza il terreno",
  autoFocus,
  defaultValue = "",
}: Props) {
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { results, loading, error } = useGeocode(query);
  const listId = useId();
  const rootRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const choose = (place: GeocodeResult) => {
    setQuery(place.label);
    setOpen(false);
    onSelect(place);
  };

  const showList = open && query.trim().length >= 3 && (results.length > 0 || loading || error);

  return (
    <form
      ref={rootRef}
      role="search"
      className={styles.form}
      data-size={size}
      onSubmit={(event) => {
        event.preventDefault();
        const picked = active >= 0 ? results[active] : results[0];
        if (picked) choose(picked);
        else if (query.trim()) onSelect({ query: query.trim() });
      }}
    >
      <label className={styles.field}>
        <span className="visually-hidden">Cerca un terreno</span>
        <MagnifyingGlass className={styles.icon} size={size === "large" ? 20 : 17} aria-hidden="true" />
        <input
          className={styles.input}
          type="text"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder="Indirizzo, comune o foglio e particella"
          value={query}
          role="combobox"
          aria-expanded={Boolean(showList)}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (!results.length) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((i) => (i + 1) % results.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {loading ? <CircleNotch className={styles.spinner} size={16} aria-label="Ricerca in corso" /> : null}
      </label>

      <button type="submit" className={styles.submit}>
        {submitLabel}
      </button>

      {showList ? (
        <ul id={listId} role="listbox" className={styles.list}>
          {error && !results.length ? (
            <li className={styles.status}>La ricerca degli indirizzi non risponde. Riprova tra poco.</li>
          ) : null}
          {loading && !results.length ? <li className={styles.status}>Cerco…</li> : null}
          {results.map((place, index) => (
            <li
              key={place.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={styles.option}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(place)}
              onPointerEnter={() => setActive(index)}
            >
              <MapPin size={16} aria-hidden="true" className={styles.optionIcon} />
              <span>
                <span className={styles.optionLabel}>{place.label}</span>
                {place.secondary ? <span className={styles.optionSecondary}>{place.secondary}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
