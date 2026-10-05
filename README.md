# Particella

**Cosa si può costruire su un terreno?** Particella prende un punto o un indirizzo in Italia, trova la
particella catastale e incrocia per quel confine catasto, rischi naturali, vincoli ambientali, terreno,
servizi e contesto, leggendo fonti pubbliche ufficiali. Ogni valore porta con sé ente, licenza e data.

> Stato: beta in sviluppo. Le informazioni hanno valore orientativo e non sostituiscono il certificato di
> destinazione urbanistica né il parere di un tecnico abilitato.

## Cosa fa

| | |
|---|---|
| **Studio** (`/studio`) | Mappa a schermo pieno: scegli un lotto toccando la mappa, cercando un indirizzo o con la tua posizione. I livelli di analisi arrivano uno alla volta; in cima un quadro di cosa dice il piano, cosa approfondire e quali dati mancano. |
| **Chiedi al terreno** | Assistente che risponde sulle domande del lotto usando solo i dati raccolti e citando le fonti. |
| **Confronta** (`/confronta`) | Fino a quattro lotti affiancati, livello per livello. |
| **Scheda** (`/scheda/<id>`) | Pagina stampabile in A4 con sintesi, dettaglio e fonti numerate. Confine esportabile in GeoJSON e KML. |
| **API** (`/api/v1`) | Le stesse risposte in JSON, con provenienza su ogni campo. Documentazione in `/sviluppatori`. |

Livelli reali oggi: urbanistica (Firenze, Milano), vincoli paesaggistici, uso del suolo, alluvioni, frane, sismica, aree
protette, profilo del terreno, sole, servizi, raggiungibilità, popolazione, valori OMI. Enti, licenze e limiti nella
pagina `/fonti` e in [`docs/research/`](docs/research/).

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
- Prodotto: [`docs/ROADMAP.md`](docs/ROADMAP.md), mercato e pricing in
  [`docs/business/mercato-e-pricing.md`](docs/business/mercato-e-pricing.md), novità in [`CHANGELOG.md`](CHANGELOG.md).

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
AI richiede `AI_GATEWAY_API_KEY` (o OIDC su Vercel). In produzione geocoder, Overpass e routing vanno puntati su
istanze dedicate: quelle pubbliche hanno limiti d'uso stretti.

### Come lavoriamo

Il frontend è curato da Claude; il backend e la ricerca sui dati da Codex (GPT-6.1) su brief scritti, con review di
Claude prima di ogni merge. I brief stanno fuori dal repository; le decisioni sono nei messaggi di commit e nelle PR.

## Contribuire

Leggi [`CONTRIBUTING.md`](CONTRIBUTING.md) e [`AGENTS.md`](AGENTS.md). In breve: un branch per argomento,
Conventional Commits, PR verso `main` con CI verde.

## Dati e attribuzioni

I dati restano dei rispettivi titolari e sono usati secondo le loro licenze (per esempio catasto © Agenzia
delle Entrate, CC BY 4.0; mappe © contributori OpenStreetMap, ODbL). Il font Archivo è distribuito con
licenza SIL Open Font License (`src/fonts/OFL-Archivo.txt`).
