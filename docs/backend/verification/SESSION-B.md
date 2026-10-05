# Sessione B — esito verificato

6 ottobre 2026, Europe/Rome. Branch `feat/backend-layers-chat`, base `38023d0`.
Solo backend, test, script, documentazione e contenuto hero esplicitamente autorizzato.
Nessun push, PR o deploy. Nessun modello a pagamento chiamato.

## Controlli locali

| Comando                                                        | Esito                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `npm run lint`                                                 | PASS, zero warning                                                                    |
| `npm run typecheck`                                            | PASS, typegen Next e TypeScript                                                       |
| `npm test`                                                     | PASS, 50 test offline, zero chiamate reali ai provider/modello                        |
| `npm run build`                                                | PASS, Next 16.3.8 / Turbopack                                                         |
| Prettier su backend, route API, contratto, script, test e hero | PASS                                                                                  |
| `git diff --check`                                             | PASS                                                                                  |
| `npm run format:check` globale                                 | FAIL: solo `src/app/opengraph-image.tsx`, file frontend già presente e non modificato |
| `npm run content:hero`                                         | PASS, JSON reale generato                                                             |

I log `session-b-*.log` conservano l'output dei comandi. Gli import `#server/*` e
`#contracts` sono verificati dai test Node strip-types, dal typecheck bundler e
dalla build Turbopack. Nessuna modifica semantica al contratto zod:
`LayerResult.method` esisteva già; non è stato aggiunto `Plot.notes`.

## Rete reale

Ultima esecuzione `PARTICELLA_SINGLE_INSTANCE=1 npm run test:live`: **57 PASS,
3 PARTIAL, 0 FAIL**, uscita 0. Evidenza ridotta e riproducibile in
[session-b-live.json](session-b-live.json). Le geometrie grandi sono omesse solo
da questa copia; `tests/live-results.json` contiene l'output generato completo.

| Nuovo layer                      | Firenze, lotto reale             | Milano, punto Duomo | Bagno a Ripoli, lotto reale |
| -------------------------------- | -------------------------------- | ------------------- | --------------------------- |
| landscape — MiC SITAP            | empty                            | empty               | empty                       |
| planning — PO / PGT              | ok, zona A / A1                  | ok, PGT             | outside_coverage            |
| land-cover — EEA CORINE 2018     | ok                               | ok                  | ok                          |
| accessibility — Valhalla FOSSGIS | ok, due isocrone                 | ok, due isocrone    | ok, due isocrone            |
| market — AdE OMI                 | ok, B5, 2025/2, 3.600–5.300 €/m² | ok, B12, 2025/2     | partial, R1, 2025/2         |

`empty` di SITAP è una risposta reale senza oggetti al punto: non certifica
l'assenza di vincoli. Il caso positivo art. 136 usa una fixture reale, senza
trasformare l'esito vuoto di questi tre punti in una prova positiva live.
Milano Duomo è una strada catastale: il lookup lo rifiuta correttamente; i suoi
layer sono uno smoke puntuale esplicito, non dati di una particella inventata.

I tre PARTIAL:

- Ricerca per ID a cache fredda **senza** `at`: WFS AdE non conferma il filtro;
  502 onesto. La stessa richiesta con `at` dopo questo errore passa.
- Terrain Milano: un punto non permette min/max/pendenza del lotto.
- OMI rurale: prezzi residenziali presenti, tipologia prevalente non dichiarata;
  vengono mostrate le tipologie disponibili senza inventarne la prevalenza.

Geocode live verificato per Via Tortona 31 Milano, Bagno a Ripoli e Piazza della
Signoria Firenze. Il caso Nominatim 429 → Photon è verificato offline con la
risposta Photon reale. Province FI/MI e nomi confermati. I tre proxy tile
cadastre/flood/landslide restituiscono PNG validi; trasparenza crema e
conservazione di linee/attribuzione sono verificate sui pixel della PNG reale.

Un'esecuzione precedente aveva tre errori transitori di connessione AdE. Il
retry completo finale, in un nuovo processo, passa; questo non implica uno SLA
delle fonti pubbliche. Non è stato modificato il codice per mascherare i guasti.

## HTTP Next di produzione

Build avviata su porta temporanea 3137, poi arrestata. Tutti i **10 controlli
HTTP** passano, evidenza in [session-b-http.json](session-b-http.json):

- ID + `at` a cache fredda → 200, Firenze foglio 173 particella 68.
- Punto di altra particella → 404 e messaggio richiesto; `at` malformato → 400.
- Layer planning → 200; report → 200 con tutti i 13 layer.
- Health e catalogo → 200; geocode del civico Tortona → 200.
- PlotAt rurale → 200, Bagno a Ripoli foglio 60 particella 110.
- POST chat senza credenziali → 503 `not_configured`.

Nel processo di produzione `services` è `outside_coverage` con Overpass pubblico
predefinito, come previsto dalla policy già presente: richiede hosting dedicato.
Le isocrone funzionano con `PARTICELLA_SINGLE_INSTANCE=1`; conteggi servizi null
quando Overpass non è configurato. Non confondere questa prova HTTP con lo smoke
Node, dove Overpass pubblico è ammesso per ricerca locale.

## Contenuto e limiti

Hero reale: punto 43.769270,11.256500 interno alla particella di Palazzo Vecchio,
Firenze, ID `it:D612:_:173:68`, area geometrica circa 6.375 m². Il JSON autorizzato
contiene poligono vero, quattro righe vere ≤40 caratteri (planning, flood,
seismic, solar) e risposta Plot abbreviata dello stesso punto.

La chat è verificata con tool finti e `MockLanguageModelV4` AI SDK 7, compreso
stream UI e tool-loop. Autenticazione/modello live **NOT RUN**: nessuna chiave o
OIDC disponibile. Il frontend che invia solo `plotId` deve aggiungere `at` per
garantire anche la chat su un'istanza fredda; modulo Server Component
`getPlotReport(id, at)` disponibile per Scheda.

SITAP/planning sono puntuali, non intersezione integrale. CORINE 2018 è una
classificazione ampia, prevalenza stimata su punti: nessuna percentuale
impermeabilizzata inventata. OMI è zona, non prezzo del lotto. Licenza PGT Milano
e SITAP non accertata e dichiarata. Le API demo/geocoder e i limiter locali
richiedono hosting/limiti condivisi prima della produzione distribuita.

## Git: BLOCKED

La creazione del lock dell'indice condiviso è negata dal sandbox:

```text
fatal: Unable to create '/Users/francescogiannicola/Documents/ChatGPT/Particella/.git/worktrees/Particella-backend/index.lock': Operation not permitted
```

Nessun commit è stato creato. Il blocco impedisce anche `git rm --cached
tests/live-results.json`: la regola gitignore è aggiunta, ma il file già tracciato
resta nell'indice. Non è stata aggirata la restrizione.
Le modifiche sono reviewabili nel worktree; nessun push/PR.

Quando Git è scrivibile, mantenere commit separati per import, budget cache,
provenance, doppio lookup comunale, validazione HTTP, leggibilità, risoluzione
ID/at, dati/layer, chat, contenuto e documentazione. Il file live generato deve
essere tolto dall'indice prima dello staging della consegna.
