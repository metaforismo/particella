import type { Metadata } from "next";
import { LAYER_BY_ID } from "@/content/layers";
import { formatDate } from "@/lib/format";
import { layerCatalog } from "@/server/core/layers";
import { sources, type SourceDefinition } from "@/server/core/sources";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Fonti e licenze",
  description: "Da dove arrivano i dati di Particella, con quali licenze e con quali limiti.",
};

const PROTOCOL_LABEL: Record<SourceDefinition["protocol"], string> = {
  REST: "API",
  WMS: "Mappa WMS",
  WFS: "Dati WFS",
  snapshot: "Archivio scaricato",
};

function layersUsing(sourceId: string) {
  return layerCatalog
    .filter((layer) => layer.sourceIds.includes(sourceId))
    .map((layer) => LAYER_BY_ID[layer.id]?.title ?? layer.title);
}

export default function SourcesPage() {
  const official = sources.filter((s) => s.isOfficial);
  const community = sources.filter((s) => !s.isOfficial);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Fonti e licenze</h1>
        <p>
          Particella non produce dati propri sul territorio: legge quelli pubblicati da enti pubblici e da
          progetti aperti, li riporta sullo stesso confine e dice sempre da dove arrivano.
        </p>
      </header>

      <ul className={styles.principles}>
        <li>
          <strong>Prima le fonti ufficiali.</strong> Catasto, rischi e vincoli vengono da enti dello Stato e
          delle Regioni. I dati collaborativi, come OpenStreetMap, sono indicati come tali.
        </li>
        <li>
          <strong>Ogni valore ha una data.</strong> Accanto a ogni risultato trovi l&apos;ente, la licenza e
          il momento in cui la fonte è stata consultata.
        </li>
        <li>
          <strong>Un vuoto non è un via libera.</strong> Se una fonte non risponde o non copre un luogo lo
          scriviamo, senza trasformarlo in &ldquo;nessun rischio&rdquo;.
        </li>
      </ul>

      <PlanningCoverage />

      <SourceGroup title="Enti pubblici" items={official} />
      <SourceGroup title="Dati aperti collaborativi" items={community} />

      <section id="limiti" className={styles.limits} aria-labelledby="limits-title">
        <h2 id="limits-title">Limiti dei dati</h2>
        <dl>
          <div>
            <dt>Valore orientativo</dt>
            <dd>
              Le informazioni non sostituiscono il certificato di destinazione urbanistica, le verifiche
              presso gli uffici competenti né il parere di un tecnico abilitato.
            </dd>
          </div>
          <div>
            <dt>Superfici</dt>
            <dd>
              Area e perimetro sono calcolati sul poligono della mappa catastale. Possono differire dalla
              superficie censuaria riportata in visura.
            </dd>
          </div>
          <div>
            <dt>Copertura del catasto</dt>
            <dd>
              Il servizio cartografico dell&apos;Agenzia delle Entrate non copre le Province autonome di
              Trento e Bolzano, che hanno un catasto proprio.
            </dd>
          </div>
          <div>
            <dt>Piani urbanistici</dt>
            <dd>
              Ogni Comune pubblica il proprio piano in modo diverso. Li colleghiamo uno alla volta,
              verificando licenza e vigenza; dove non sono ancora collegati il livello lo dice esplicitamente.
            </dd>
          </div>
          <div>
            <dt>Rischi sul punto</dt>
            <dd>
              Alcune fonti si possono interrogare solo su un punto e non sull&apos;intero lotto. Ogni livello
              indica se il dato riguarda la particella, un punto, i dintorni, una cella censuaria o il Comune.
            </dd>
          </div>
          <div>
            <dt>Aggiornamento</dt>
            <dd>
              Le risposte vengono conservate per un periodo limitato per non sovraccaricare le fonti. La data
              di consultazione è sempre indicata accanto al dato.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

/** Planning sources are split into connected and under evaluation, straight from the registry. */
function PlanningCoverage() {
  const planning = sources.filter((s) => s.id.startsWith("planning-") && !s.id.endsWith("-legend"));
  // Candidates are registered but not used by the planning layer until query and licence are qualified.
  const isCandidate = (id: string) => id.endsWith("-candidate") || id.endsWith("-status");
  const connected = planning.filter((s) => s.verification.state === "verified" && !isCandidate(s.id));
  const evaluating = planning.filter((s) => isCandidate(s.id));
  return (
    <section id="copertura" className={styles.coverage} aria-labelledby="coverage-title">
      <h2 id="coverage-title">Dove arriva l&apos;urbanistica</h2>
      <p>
        Ogni Comune pubblica il proprio piano in modo diverso. Colleghiamo una fonte solo dopo averla
        interrogata davvero e verificato la licenza; altrove il livello urbanistico lo dichiara come fuori
        copertura.
      </p>
      <div className={styles.coverageGrid}>
        <div>
          <h3>Collegati</h3>
          <ul>
            {connected.map((s) => (
              <li key={s.id}>
                <strong>{s.coverage}</strong>
                <span>
                  {s.name} · {s.authority}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>In valutazione</h3>
          <ul>
            {evaluating.map((s) => (
              <li key={s.id}>
                <strong>{s.coverage}</strong>
                <span>Fonte individuata: interrogazione, vigenza o licenza ancora da verificare.</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function SourceGroup({ title, items }: { title: string; items: readonly SourceDefinition[] }) {
  if (!items.length) return null;
  return (
    <section className={styles.group} aria-label={title}>
      <h2>{title}</h2>
      <ul className={styles.sources}>
        {items.map((s) => {
          const usedBy = layersUsing(s.id);
          return (
            <li key={s.id} className={styles.source}>
              <div className={styles.sourceMain}>
                <p className={styles.authority}>{s.authority}</p>
                <h3>{s.name}</h3>
                {usedBy.length ? <p className={styles.used}>Usata per: {usedBy.join(", ")}</p> : null}
              </div>
              <dl className={styles.facts}>
                <div>
                  <dt>Licenza</dt>
                  <dd>
                    <a href={s.licenseUrl} target="_blank" rel="noreferrer">
                      {s.license}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Copertura</dt>
                  <dd>{s.coverage}</dd>
                </div>
                <div>
                  <dt>Accesso</dt>
                  <dd>{PROTOCOL_LABEL[s.protocol]}</dd>
                </div>
                <div>
                  <dt>Verificata</dt>
                  <dd>
                    {s.verification.state === "verified" ? "Sì" : "In parte"},{" "}
                    {formatDate(s.verification.date)}
                  </dd>
                </div>
              </dl>
              <a className={styles.visit} href={s.url} target="_blank" rel="noreferrer">
                Pagina della fonte
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
