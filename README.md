# Particella

**Cosa si può costruire su un terreno?** Particella prende un punto o un indirizzo in Italia, trova la
particella catastale e incrocia per quel confine catasto, rischi naturali, vincoli ambientali, terreno,
servizi e contesto, leggendo fonti pubbliche ufficiali. Ogni valore porta con sé ente, licenza e data.

> Stato: beta in sviluppo. Le informazioni hanno valore orientativo e non sostituiscono il certificato di
> destinazione urbanistica né il parere di un tecnico abilitato.

## Tre modi di usarla

| | Cosa fa |
|---|---|
| **Studio** (`/studio`) | Mappa a schermo pieno: tocchi un lotto, i livelli di analisi arrivano uno alla volta con stato, metriche e fonti. Un assistente risponde alle domande sul terreno usando solo i dati raccolti. |
| **Scheda** (`/scheda/<id>`) | Pagina stampabile in A4 con sintesi, dettaglio per livello e fonti numerate. "Scarica PDF" usa la stampa del browser. |
| **API** (`/api/v1`) | Le stesse risposte in JSON, validate da un contratto pubblico con provenienza su ogni campo. |

## Cosa analizziamo

Urbanistica, rischi (alluvioni, frane, sismica), aree protette e Natura 2000, profilo del terreno,
esposizione solare, servizi nei dintorni, popolazione e valori immobiliari. L'elenco completo con enti e
licenze è nella pagina `/fonti` e in [`docs/research/data-sources.md`](docs/research/data-sources.md), che
documenta le verifiche fatte con richieste reali.

## Architettura in breve

```
Browser ── Studio / Scheda / Landing (React 19, MapLibre)
   │
   └── /api/v1/*  (route handler Next.js, runtime Node)
          │
          └── src/server
                ├── core/        http con limiti per host, cache, provenienza, registro fonti
                ├── geo/         geometrie, GML, aree e perimetri geodetici
                └── countries/it adapter italiani: catasto AdE, ISTAT, ISPRA, INGV, JRC, OSM…
```

- Il contratto tra UI e API è in [`src/lib/contracts`](src/lib/contracts/index.ts) (zod).
- Il core non sa nulla dell'Italia: un nuovo paese è una nuova cartella in `src/server/countries/`.
- Dettagli: [`docs/backend/ARCHITECTURE.md`](docs/backend/ARCHITECTURE.md), API in
  [`docs/backend/API.md`](docs/backend/API.md), design system in [`docs/DESIGN.md`](docs/DESIGN.md).

## Sviluppo

Requisiti: Node.js 22.19 o superiore (vedi `.nvmrc`).

```bash
npm install
npm run dev
```

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo su http://localhost:3000 |
| `npm run lint` | ESLint, zero warning ammessi |
| `npm run typecheck` | genera i tipi delle route e lancia `tsc` |
| `npm test` | test offline con fixture registrate |
| `npm run test:live` | smoke test contro le fonti reali (non gira in CI) |
| `npm run build` | build di produzione |
| `npm run format` | Prettier |

Le variabili d'ambiente sono descritte in `.env.example`. Nessuna è necessaria per avviare il sito; l'assistente
AI richiede una chiave del provider configurato.

## Contribuire

Leggi [`CONTRIBUTING.md`](CONTRIBUTING.md) e [`AGENTS.md`](AGENTS.md). In breve: un branch per argomento,
Conventional Commits, PR verso `main` con CI verde.

## Dati e attribuzioni

I dati restano dei rispettivi titolari e sono usati secondo le loro licenze (per esempio catasto © Agenzia
delle Entrate, CC BY 4.0; mappe © contributori OpenStreetMap, ODbL). Il font Archivo è distribuito con
licenza SIL Open Font License (`src/fonts/OFL-Archivo.txt`).
