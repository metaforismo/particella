# Particella — sessione D

Consegna locale del **6 ottobre 2026** sul branch `feat/planning-perf`, base `453e2be` (sessioni A–C). Nessun push, PR, merge o deploy. Modifiche backend/API, script, fixture e documentazione; frontend e contratto pubblico invariati.

## Esito

**PASS** lint, typecheck, test offline, build, Prettier e verifiche urbanistiche live. **FAIL** `test:live` completo: smoke principale 66 PASS / 6 PARTIAL / 0 FAIL; espansione successiva con 6 FAIL su layer Overpass a Bagno e Vallombrosa; quattro adapter urbanistici supplementari PASS. I FAIL non sono stati nascosti o trasformati in vuoti. **BLOCKED** ulteriori commit: `git add` non può creare `Particella/.git/worktrees/Particella-backend/index.lock` («Operation not permitted»). Il primo commit `c574b2c` è riuscito; tutte le modifiche successive sono conservate nel worktree. Non è disponibile escalation in questa sessione. Le referenze remote condivise sono avanzate durante il lavoro; il branch non è stato riallineato o rimaneggiato.

## Copertura prima / dopo

Prima: Firenze (PO) e Milano (un solo layer della sintesi PGT).

Dopo: Firenze, Siena, Torino; adapter regionali **Lombardia** (Comuni presenti nel mosaico, tre temi con una richiesta) e **Veneto** (Comuni presenti nel mosaico PI/PAT/PRG). Verificati live positivi Milano/Bergamo, Sona, Torino R2/ZUSA3, Siena A/CS2; vuoti Lodi, Verona/Vicenza e Torino Piazza Castello sui rispettivi punti di ricerca. I mosaici non certificano tutti i Comuni né la vigenza delle regole comunali. Registro: 26 fonti iniziali → 37, incluse fonti candidate senza provider.

[Tabella completa di fonti, stato e licenze](PLANNING-COVERAGE.md). CC BY 4.0: Lombardia, Firenze, Siena, Torino; IODL 2.0: Veneto. Lombardia e Veneto dichiarati **non conformativi** in notes e method. Emilia-Romagna PSC non collegato per query incoerenti; non si è dimostrato un mosaico PUG. Toscana regionale: stato/iter, non zone del lotto. Prato risponde ma licenza non accertata; Pisa, Puglia/Salento e Roma non qualificati per integrazione. Licenze specifiche da chiarire per questi candidati; nessuna licenza dei download comunali viene trasferita al mosaico regionale.

## Report: misure reali

Ogni lotto in un processo Node nuovo, cache HTTP/layer/plot fredda, seguito da una chiamata calda. Report route handler con `at`: include risoluzione catastale, attese host e calcoli; esclude startup Next, trasporto HTTP, rendering e distribuzione. Cache remota non configurata. I provider lavorano in parallelo: **non sommare** i tempi dei layer. `Server-Timing` comprende cadastre, ciascun layer e total, anche nelle risposte di errore.

| Lotto reale                                | Freddo prima | Freddo dopo | Caldo dopo | Completezza dopo                    |
| ------------------------------------------ | -----------: | ----------: | ---------: | ----------------------------------- |
| Milano urbano `it:F205:_:390:61`           |      9,895 s |     6,878 s |     9,2 ms | OSM unavailable; vedere stati sotto |
| Bagno a Ripoli agricolo `it:A564:_:60:110` |     24,349 s |     7,769 s |     4,4 ms | OSM unavailable; vedere stati sotto |
| Vallombrosa montano `it:H222:_:28:60`      |     21,156 s |     7,710 s |     8,2 ms | OSM unavailable; vedere stati sotto |

**Obiettivo di latenza osservato: <8 s su tutti e tre i lotti. La serie finale ha però quattro layer OSM unavailable per lotto. Non è un report completo recuperato in meno di otto secondi.** Accessibilità conserva le isocrone con conteggi servizi null se Overpass manca. Inoltre market è partial a Bagno/Vallombrosa e terrain è partial a Vallombrosa. Nel live smoke separato OSM risponde su Milano e Toscana: una sola query restituisce dati reali, ma la disponibilità entro il budget non è garantita.

Tempi in **ms**, `prima → dopo` (arrotondati). Provenienza integrale e stati in [before/after JSON](verification/session-d/).

| Fase / layer               |      Milano |        Bagno |  Vallombrosa |
| -------------------------- | ----------: | -----------: | -----------: |
| `cadastre`                 |   820 → 817 |  1330 → 1730 |  1361 → 1699 |
| `power-grid`               | 5292 → 6010 | 19470 → 6002 |  2362 → 6002 |
| `infrastructure-distances` | 5291 → 6009 | 19470 → 6002 |  2361 → 6001 |
| `industrial-sites`         | 5291 → 6009 | 19470 → 6002 |  2361 → 6001 |
| `regional-land-cover`      |   410 → 341 |    268 → 327 |    270 → 254 |
| `flood`                    | 2687 → 2813 |  2244 → 2157 |  4067 → 2163 |
| `landslide`                | 2966 → 3047 |  3391 → 3250 |  4166 → 3377 |
| `seismic`                  |   391 → 386 |    306 → 372 |    397 → 406 |
| `protected-areas`          | 1740 → 1763 |  1758 → 1778 |  2861 → 1710 |
| `terrain`                  | 1432 → 1382 |  1082 → 1121 |    264 → 358 |
| `solar`                    | 1002 → 1122 |   994 → 1073 |    987 → 952 |
| `services`                 | 9069 → 6023 | 23011 → 6004 | 19790 → 6002 |
| `demographics`             |   101 → 220 |     100 → 88 |    146 → 110 |
| `landscape`                |   605 → 596 |    608 → 625 |    631 → 605 |
| `planning`                 |   833 → 920 |      15 → 13 |      10 → 16 |
| `land-cover`               |   394 → 476 |    471 → 435 |    493 → 494 |
| `accessibility`            | 9070 → 6046 | 23013 → 6006 | 19790 → 6003 |
| `market`                   | 2220 → 2004 |  2045 → 1695 |  2787 → 1632 |
| `total`                    | 9895 → 6878 | 24349 → 7768 | 21156 → 7710 |

### Percorso critico e interventi

Prima Overpass: query land condivisa da tre layer, seguita da query services distinta, limiter a uno slot e avvii distanziati di 5 s. Dopo: **una richiesta per lotto** fra quattro provider. Due output nella stessa query: geometrie/tag per land e centri/tag per servizi; relazioni dei servizi sono accettate senza attribuire loro distanze geometriche land. Calcolo delle distanze dal confine una sola volta per payload/lotto, invece di tre.

Il limite Overpass resta concurrency=1, 0,2 richieste/s, 5 s tra avvii: non rimosso. La policy pubblica usa slot/cooldown dinamici, non promette una latenza; si continua a rispettare Retry-After e a richiedere hosting dedicato in produzione. Nessuna rotazione di host per aggirare limiti. Il limiter già separa gli host; non serviva serializzare o riparallelizzare le fonti diverse. Budget OSM 6 s incluso HTTP/coda, query server 5 s e nessun retry automatico; deadline accessibilità 6 s, altri layer 6,5 s. Timeout → unavailable, mai empty o zero. I benchmark finali registrano un solo avvio Overpass per lotto, interrotto intorno a 6 s senza status HTTP. **Il budget scelto può sacrificare dati che arriverebbero più tardi**: è un compromesso esplicito, non una prova di indisponibilità assoluta della fonte.

Risoluzione catastale: una sola per report; richieste concorrenti con lo stesso ID e punto condividono anche il lavoro in corso fra route/factory. Punti diversi, adapter diversi e cache diverse non vengono unificati. Cache layer versionata `layer:v2`. [Cache condivisa opzionale](CACHE.md): Redis REST con fallback memoria, testata offline; non è un limiter distribuito e non è stata testata contro un Redis reale.

Riproduzione (seriale, ciascun comando è un processo nuovo):

```bash
node --experimental-strip-types scripts/bench/report.ts 0 /tmp/milano.json
node --experimental-strip-types scripts/bench/report.ts 1 /tmp/bagno.json
node --experimental-strip-types scripts/bench/report.ts 2 /tmp/vallombrosa.json
node --experimental-strip-types scripts/session-d-live.ts
node --experimental-strip-types scripts/session-d-live.ts plots
```

## Formattazione e robustezza

Helper unico `src/server/core/format.ts`, `useGrouping: always`: `60,1 m`, `1.351 kWh`, `1,3 km`. Usato per quote, produzione PVGIS, popolazione, conteggi servizi, prezzi OMI e distanze OSM; metriche numeriche e richieste macchina restano tipizzate. Test offline scorre headline e notes di tutti i 17 provider; ammette raggruppamenti italiani e preserva URL/versioni di licenza. Nessun dato mancante sostituito con stime.

Correzioni AdE verificate con fixture reali: riferimenti legacy senza underscore (`H501A048500`, `D969A006700`, `L736A0015DZ`); foglio dichiarato `15DZ`; particella letterale `H`. Il foglio si legge sempre da LABEL, senza dedurlo dal riferimento. Comune, riferimento della mappa e particella devono coincidere; strade/acque restano errori espliciti. Identificativi con questi formati diventano accettati anche da `parsePlotId` per l'apertura successiva del report. Fixture originali e hash nel manifest.

## Dieci punti casuali reali

Campionamento stratificato: dieci ancore regionali, jitter uniforme ±0,001° con seed `20261006`. Nessuna ricerca della particella più vicina, nessuno spostamento del punto dopo un fallimento. Prima serie: Roma/Genova/Venezia 502 per parser; dopo le correzioni gli stessi punti rispondono 200. Sei particelle, due strade, Trento fuori copertura: **9 PASS / 1 PARTIAL**, Cagliari eccezione AdE dopo entrambe le bbox. Anche quest'ultimo è un errore chiaro; non una particella inventata. La serie non costituisce un campione rappresentativo dell'intero territorio italiano.

| Punto / regione                                  | Latitudine | Longitudine | HTTP | Esito finale                                                                                                                                     |
| ------------------------------------------------ | ---------: | ----------: | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Torino urbano / Piemonte                         | 45.0598762 |   7.6706175 |  404 | Il punto ricade su una strada o un'acqua catastale: non è un lotto.                                                                              |
| Milano urbano / Lombardia                        | 45.4642673 |   9.1909593 |  200 | `it:F205:_:390:H`                                                                                                                                |
| Bologna urbano / Emilia-Romagna                  |  44.494363 |  11.3435722 |  404 | Il punto ricade su una strada o un'acqua catastale: non è un lotto.                                                                              |
| Venezia costa/canali / Veneto                    | 45.4335819 |  12.3383914 |  200 | `it:L736:A:15DZ:3384`                                                                                                                            |
| Roma urbano / Lazio                              | 41.8997564 |  12.4757086 |  200 | `it:H501:A:485:238`                                                                                                                              |
| Lecce urbano / Puglia                            | 40.3536604 |  18.1713357 |  200 | `it:E506:_:259D:808`                                                                                                                             |
| Genova costa / Liguria                           | 44.4060274 |   8.9328967 |  200 | `it:D969:A:67:266`                                                                                                                               |
| Cagliari costa / Sardegna                        | 39.2144577 |   9.1102999 |  502 | Il servizio catastale non riesce a leggere la mappa in questo punto. Riprovare più tardi o scegliere un altro punto interno allo stesso terreno. |
| Vallombrosa montagna/campagna / Toscana          | 43.7322434 |  11.5568304 |  200 | `it:H222:_:19:33`                                                                                                                                |
| Trento fuori copertura AdE / Trentino-Alto Adige | 46.0678214 |  11.1205862 |  404 | La cartografia AdE non copre le province autonome di Trento e Bolzano.                                                                           |

Bolzano non campionato in questa serie; la guardia AdE già esistente comprende entrambe le province autonome. [Esiti macchina](verification/session-d/random-plots.json), [prima delle correzioni](verification/session-d/random-plots-before.json).

## Verifiche finali

| Controllo                                    | Esito                                                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm run lint`                               | PASS, zero warning                                                                                         |
| `npm run typecheck`                          | PASS                                                                                                       |
| `npm test`                                   | PASS, 90 test offline                                                                                      |
| `npm run build`                              | PASS, Next.js 16.3.8                                                                                       |
| Prettier su server, route API, test e script | PASS                                                                                                       |
| `git diff --check`                           | PASS                                                                                                       |
| `npm run test:live`                          | FAIL exit 1: smoke 66 PASS / 6 PARTIAL / 0 FAIL; espansione 6 FAIL Overpass; planning supplementare 4 PASS |
| Dieci punti AdE                              | 9 PASS / 1 PARTIAL per eccezione della fonte a Cagliari                                                    |
| Commit successivi al primo                   | BLOCKED dal sandbox sulla creazione di index.lock                                                          |

Log e risultati: [verification/session-d](verification/session-d/). Il FAIL live non viene cancellato da fixture o benchmark successivi. Nessuna promessa di servizio commerciale continuo, copertura nazionale o certificazione urbanistica. Nessun valore stimato viene presentato come misurato; terrain/PVGIS/OSM mantengono i limiti preesistenti nei testi e nella provenienza.
