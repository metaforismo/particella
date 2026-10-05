"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowClockwise, ChatCircleText, ClockCounterClockwise, Stack } from "@phosphor-icons/react";
import { formatArea } from "@/lib/format";
import { LogoMark } from "@/components/brand/Logo";
import { PlaceSearch } from "@/components/search/PlaceSearch";
import type { GeocodeResult, LatLon } from "@/lib/contracts";
import { AskPanel } from "./AskPanel";
import { LayerList } from "./LayerList";
import { PlotHeader } from "./PlotHeader";
import { StudioMap } from "./StudioMap";
import { forgetRecentPlots, useRecentPlots } from "./recent";
import { useStudio } from "./useStudio";
import styles from "./Studio.module.css";

export type StudioInitial = { plotId?: string; point?: LatLon; query?: string };

const EXAMPLES: { label: string; detail: string; point: LatLon }[] = [
  { label: "Campagna a Bagno a Ripoli", detail: "Firenze", point: { lat: 43.7, lon: 11.32 } },
];

const PANEL_WIDTH = 384;

export function Studio({ initial }: { initial: StudioInitial }) {
  const studio = useStudio();
  const { selection, layers, activeLayer, selectPoint, selectPlotId, setActiveLayer, retryLayer, clear } =
    studio;
  const recent = useRecentPlots();
  const searchRef = useRef<HTMLInputElement>(null);
  const [showCadastre, setShowCadastre] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  /** Phones show one view at a time inside the bottom sheet. */
  const [sheetTab, setSheetTab] = useState<"terreno" | "chiedi">("terreno");
  const started = useRef(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 820px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // "/" jumps to search, Escape closes the open layer detail.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.closest("input, textarea, [contenteditable]");
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "Escape" && !typing) {
        setActiveLayer(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setActiveLayer]);

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
  const askVisible = Boolean(plot) && askOpen && !narrow;
  const inset = useMemo(
    () =>
      narrow
        ? { left: 0, right: 0, bottom: 260 }
        : { left: PANEL_WIDTH + 16, right: askVisible ? PANEL_WIDTH + 16 : 0, bottom: 0 },
    [narrow, askVisible],
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
          <PlaceSearch
            size="compact"
            submitLabel="Cerca"
            defaultValue={initial.query}
            inputRef={searchRef}
            onSelect={onSearch}
          />
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
        {!narrow ? (
          <button
            type="button"
            className={styles.ask}
            aria-pressed={askVisible}
            disabled={!plot}
            title={plot ? undefined : "Scegli prima un terreno"}
            onClick={() => setAskOpen((v) => !v)}
          >
            <ChatCircleText size={16} aria-hidden="true" />
            Chiedi al terreno
          </button>
        ) : null}
      </header>

      {askVisible && plot ? (
        <aside className={styles.askPanel}>
          <AskPanel key={plot.id} plot={plot} onClose={() => setAskOpen(false)} />
        </aside>
      ) : null}

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

        {narrow && plot ? (
          <div className={styles.tabs} role="tablist" aria-label="Vista">
            <button
              type="button"
              role="tab"
              aria-selected={sheetTab === "terreno"}
              onClick={() => setSheetTab("terreno")}
            >
              Terreno
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sheetTab === "chiedi"}
              onClick={() => {
                setSheetTab("chiedi");
                setSheetOpen(true);
              }}
            >
              Chiedi al terreno
            </button>
          </div>
        ) : null}

        {narrow && plot && sheetTab === "chiedi" ? (
          <div className={styles.sheetAsk}>
            <AskPanel key={plot.id} plot={plot} />
          </div>
        ) : null}

        <div className={styles.scroll} hidden={narrow && Boolean(plot) && sheetTab === "chiedi"}>
          {selection.status === "idle" ? (
            <div className={styles.empty}>
              <p className={styles.shortcut}>
                Premi <kbd>/</kbd> per cercare
              </p>
              <h1>Scegli un terreno</h1>
              <p>
                Cerca un indirizzo qui sopra oppure tocca un punto sulla mappa. Più ti avvicini, più è facile
                centrare la particella giusta.
              </p>
              {recent.length ? (
                <>
                  <div className={styles.recentHead}>
                    <p className={styles.examplesTitle}>
                      <ClockCounterClockwise size={13} aria-hidden="true" /> Visti di recente
                    </p>
                    <button type="button" onClick={forgetRecentPlots}>
                      Cancella
                    </button>
                  </div>
                  <ul className={styles.examples}>
                    {recent.map((r) => (
                      <li key={r.id}>
                        <button type="button" onClick={() => selectPlotId(r.id)}>
                          <strong>{r.label}</strong>
                          <span>
                            {[r.place, r.areaM2 != null ? formatArea(r.areaM2) : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
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
              <LayerList
                layers={layers}
                active={activeLayer}
                onToggle={setActiveLayer}
                onRetry={retryLayer}
              />
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
