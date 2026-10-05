"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowClockwise, Stack } from "@phosphor-icons/react";
import { LogoMark } from "@/components/brand/Logo";
import { PlaceSearch } from "@/components/search/PlaceSearch";
import type { GeocodeResult, LatLon } from "@/lib/contracts";
import { LayerList } from "./LayerList";
import { PlotHeader } from "./PlotHeader";
import { StudioMap } from "./StudioMap";
import { useStudio } from "./useStudio";
import styles from "./Studio.module.css";

export type StudioInitial = { plotId?: string; point?: LatLon; query?: string };

const EXAMPLES: { label: string; detail: string; point: LatLon }[] = [
  { label: "Campagna a Bagno a Ripoli", detail: "Firenze", point: { lat: 43.7, lon: 11.32 } },
];

const PANEL_WIDTH = 384;

export function Studio({ initial }: { initial: StudioInitial }) {
  const studio = useStudio();
  const { selection, layers, activeLayer, selectPoint, selectPlotId, setActiveLayer, clear } = studio;
  const [showCadastre, setShowCadastre] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 820px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Deep links: /studio?plot=… or /studio?lat=…&lon=…
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (initial.plotId) selectPlotId(initial.plotId);
    else if (initial.point) selectPoint(initial.point);
    else if (initial.query) {
      // Free text from the landing page: take the best geocoder match, if any.
      fetch(`/api/v1/geocode?q=${encodeURIComponent(initial.query)}`)
        .then((res) => (res.ok ? (res.json() as Promise<{ results: GeocodeResult[] }>) : null))
        .then((body) => {
          const best = body?.results[0];
          if (best) selectPoint(best.center);
        })
        .catch(() => {});
    }
  }, [initial, selectPlotId, selectPoint]);

  const pick = useCallback(
    (point: LatLon) => {
      selectPoint(point);
      setSheetOpen(true);
    },
    [selectPoint],
  );

  const onSearch = useCallback(
    (place: GeocodeResult | { query: string }) => {
      if ("center" in place) pick(place.center);
    },
    [pick],
  );

  const plot = selection.status === "ready" ? selection.plot : null;
  const pending = selection.status === "locating" ? selection.point : null;
  const activeState = activeLayer ? layers[activeLayer] : undefined;
  const activeResult = activeState?.status === "done" ? activeState.result : null;
  const inset = useMemo(
    () => (narrow ? { left: 0, right: 0, bottom: 260 } : { left: PANEL_WIDTH + 16, right: 0, bottom: 0 }),
    [narrow],
  );

  return (
    <div className={styles.studio}>
      <StudioMap
        plot={plot}
        pending={pending}
        activeResult={activeResult}
        showCadastre={showCadastre}
        inset={inset}
        onPick={pick}
      />

      <header className={styles.bar}>
        <Link href="/" className={styles.home} aria-label="Particella, torna alla home">
          <LogoMark size={22} />
        </Link>
        <div className={styles.search}>
          <PlaceSearch size="compact" submitLabel="Cerca" defaultValue={initial.query} onSelect={onSearch} />
        </div>
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={showCadastre}
          onClick={() => setShowCadastre((v) => !v)}
        >
          <Stack size={16} aria-hidden="true" />
          <span>Particelle</span>
        </button>
      </header>

      <aside className={styles.panel} data-open={sheetOpen || undefined} aria-label="Analisi del terreno">
        <button
          type="button"
          className={styles.handle}
          aria-label={sheetOpen ? "Riduci il pannello" : "Espandi il pannello"}
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen((v) => !v)}
        >
          <span />
        </button>

        <div className={styles.scroll}>
          {selection.status === "idle" ? (
            <div className={styles.empty}>
              <h1>Scegli un terreno</h1>
              <p>
                Cerca un indirizzo qui sopra oppure tocca un punto sulla mappa. Più ti avvicini, più è facile
                centrare la particella giusta.
              </p>
              <p className={styles.examplesTitle}>Oppure parti da un esempio</p>
              <ul className={styles.examples}>
                {EXAMPLES.map((ex) => (
                  <li key={ex.label}>
                    <button type="button" onClick={() => pick(ex.point)}>
                      <strong>{ex.label}</strong>
                      <span>{ex.detail}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {selection.status === "locating" ? (
            <div className={styles.locating} aria-live="polite">
              <p>Cerco la particella catastale in questo punto…</p>
              <span className={styles.skeleton} style={{ width: "40%" }} />
              <span className={styles.skeleton} style={{ width: "75%", height: "1.6rem" }} />
              <span className={styles.skeleton} style={{ width: "100%", height: "3rem" }} />
            </div>
          ) : null}

          {selection.status === "error" ? (
            <div className={styles.error} role="alert">
              <h1>Nessun terreno qui</h1>
              <p>{selection.message}</p>
              {selection.point ? (
                <button type="button" onClick={() => selection.point && selectPoint(selection.point)}>
                  <ArrowClockwise size={15} aria-hidden="true" /> Riprova
                </button>
              ) : null}
            </div>
          ) : null}

          {plot ? (
            <>
              <PlotHeader plot={plot} onClear={clear} />
              <LayerList layers={layers} active={activeLayer} onToggle={setActiveLayer} />
              <p className={styles.disclaimer}>
                Valore orientativo. Non sostituisce il certificato di destinazione urbanistica né il parere di
                un tecnico abilitato.
              </p>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
