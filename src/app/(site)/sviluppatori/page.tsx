import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { LAYER_SAMPLE } from "@/content/api-sample";
import { LAYERS } from "@/content/layers";
import { formatNumber } from "@/lib/format";
import { API_LIMITS } from "@/server/http/rate-limit";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "API per sviluppatori",
  description:
    "Le analisi di Particella in JSON: catasto, rischi, vincoli e contesto con provenienza su ogni campo.",
};

const ENDPOINTS = [
  { path: "/api/v1/geocode?q=…", what: "Cerca indirizzi e luoghi in Italia." },
  { path: "/api/v1/plots/at?lat=…&lon=…", what: "Trova la particella catastale che contiene un punto." },
  {
    path: "/api/v1/plots/{id}?at=…",
    what: "Restituisce una particella dato l'identificativo e un suo punto interno.",
  },
  {
    path: "/api/v1/plots/{id}/layers/{layer}?at=…",
    what: "Un singolo livello di analisi per la particella.",
  },
  { path: "/api/v1/plots/{id}/report?at=…", what: "Tutti i livelli insieme, come nella scheda." },
  { path: "/api/v1/catalog/layers", what: "Elenco dei livelli e delle fonti che usano." },
  { path: "/api/v1/catalog/sources", what: "Registro delle fonti con ente, licenza e copertura." },
] as const;

const ERRORS = [
  { code: "bad_request", status: 400, what: "Parametri mancanti o non validi; il messaggio indica quale." },
  {
    code: "not_found",
    status: 404,
    what: "Nessuna particella nel punto, oppure il punto ricade su strade o acque.",
  },
  { code: "rate_limited", status: 429, what: "Troppe richieste: rispetta l'intestazione Retry-After." },
  { code: "upstream_unavailable", status: 502, what: "La fonte pubblica non ha risposto in tempo." },
  { code: "not_configured", status: 503, what: "Funzione non attiva in questo ambiente." },
] as const;

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const QUICKSTART = `# 1. Dal punto alla particella
curl "${BASE}/api/v1/plots/at?lat=43.7&lon=11.32"

# 2. Un livello di analisi, con l'id e il punto interno restituiti al passo 1
curl "${BASE}/api/v1/plots/it:A564:_:60:110/layers/flood?at=43.700437,11.319406"`;

const SECTIONS = [
  { id: "inizio", label: "Per iniziare" },
  { id: "identificativi", label: "Identificativi" },
  { id: "endpoint", label: "Endpoint" },
  { id: "risposte", label: "Risposte" },
  { id: "errori", label: "Errori" },
  { id: "limiti", label: "Limiti e specifica" },
  { id: "uso", label: "Uso corretto" },
] as const;

export default function DevelopersPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>API per sviluppatori</h1>
        <p>
          Le stesse analisi dello Studio in JSON, validate da un contratto pubblico. Ogni livello dice da
          quale fonte arriva, con quale licenza, quando è stato letto e a quale area si riferisce.
        </p>
      </header>

      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="In questa pagina">
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.content}>
          <section id="inizio">
            <h2>Per iniziare</h2>
            <p>
              Durante la beta l&apos;API è aperta e non richiede chiavi. Le risposte sono in italiano, le
              misure in unità del Sistema internazionale e le coordinate in WGS84 (longitudine, latitudine nei
              GeoJSON).
            </p>
            <CodeBlock label="Terminale" code={QUICKSTART} />
          </section>

          <section id="identificativi">
            <h2>Identificativi</h2>
            <p>
              Una particella si identifica con{" "}
              <code translate="no">
                it:&lt;codice catastale&gt;:&lt;sezione&gt;:&lt;foglio&gt;:&lt;particella&gt;
              </code>
              , per esempio <code translate="no">it:A564:_:60:110</code> (Bagno a Ripoli, foglio 60,
              particella 110; il trattino basso indica l&apos;assenza di sezione).
            </p>
            <p>
              Il servizio catastale non permette sempre di ritrovare una particella dal solo identificativo.
              Per questo le chiamate per particella accettano <code>at=lat,lon</code>, un punto interno al
              lotto: usa quello restituito in <code>centroid</code>.
            </p>
          </section>

          <section id="endpoint">
            <h2>Endpoint</h2>
            <p>Tutte le chiamate sono GET e restituiscono JSON, tranne i tile delle mappe.</p>
            <ul className={styles.endpoints}>
              {ENDPOINTS.map((e) => (
                <li key={e.path}>
                  <code translate="no">GET {e.path}</code>
                  <span>{e.what}</span>
                </li>
              ))}
            </ul>
            <p className={styles.small}>
              Livelli disponibili:{" "}
              {LAYERS.map((l, i) => (
                <span key={l.id}>
                  <code translate="no">{l.id}</code>
                  {i < LAYERS.length - 1 ? ", " : ""}
                </span>
              ))}
              .
            </p>
          </section>

          <section id="risposte">
            <h2>Risposte</h2>
            <p>
              Ogni livello ha uno <code>status</code> che distingue ciò che spesso viene confuso:
              <code>empty</code> significa che la fonte ha risposto e non ha nulla in quel luogo,
              <code>outside_coverage</code> che la fonte non copre quel luogo, <code>unavailable</code> che
              non ha risposto. Lo <code>scope</code> dice se il valore riguarda la particella, un punto, i
              dintorni, una cella censuaria, una zona o il Comune.
            </p>
            <CodeBlock label="Risposta reale abbreviata · livello frane" code={LAYER_SAMPLE} />
          </section>

          <section id="errori">
            <h2>Errori</h2>
            <p>
              Gli errori hanno sempre la forma {"{ error: { code, message } }"}, con un messaggio in italiano.
            </p>
            <table className={styles.errors}>
              <thead>
                <tr>
                  <th scope="col">Codice</th>
                  <th scope="col">HTTP</th>
                  <th scope="col">Quando</th>
                </tr>
              </thead>
              <tbody>
                {ERRORS.map((e) => (
                  <tr key={e.code}>
                    <td>
                      <code translate="no">{e.code}</code>
                    </td>
                    <td className="num">{e.status}</td>
                    <td>{e.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section id="limiti">
            <h2>Limiti e specifica</h2>
            <p>
              La specifica OpenAPI 3.1 completa, generata dallo stesso contratto che valida le risposte, è su{" "}
              <a href="/api/v1/openapi.json">
                <code translate="no">/api/v1/openapi.json</code>
              </a>
              . Il servizio conta le richieste per indirizzo di rete, in finestre di un minuto:
            </p>
            <table className={styles.errors}>
              <thead>
                <tr>
                  <th scope="col">Tipo di richiesta</th>
                  <th scope="col">Al minuto</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Ricerca testuale, cataloghi, stato</td>
                  <td className="num">{API_LIMITS.light.anonymous}</td>
                </tr>
                <tr>
                  <td>Particelle, livelli, report, lotti, ricerca catastale</td>
                  <td className="num">{API_LIMITS.heavy.anonymous}</td>
                </tr>
                <tr>
                  <td>Tile della mappa</td>
                  <td className="num">{formatNumber(API_LIMITS.tiles.anonymous, 0)}</td>
                </tr>
              </tbody>
            </table>
            <p>
              Oltre il limite la risposta è <code>429</code> con l&apos;intestazione <code>Retry-After</code>.
              Le chiavi API con limiti più alti arriveranno con i piani per le integrazioni.
            </p>
          </section>

          <section id="uso">
            <h2>Uso corretto</h2>
            <ul className={styles.rules}>
              <li>
                Cita le fonti come indicato in <code>provenance</code>: le licenze lo richiedono.
              </li>
              <li>
                Non trasformare uno stato <code>empty</code> o <code>unavailable</code> in &ldquo;nessun
                rischio&rdquo;.
              </li>
              <li>
                Conserva il risultato invece di ripetere la stessa richiesta: le fonti pubbliche hanno limiti.
              </li>
              <li>
                Durante la beta i limiti possono cambiare: non usare l&apos;API pubblica per carichi massivi.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
