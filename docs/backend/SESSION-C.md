# Sessione C — dati reali per lo scouting terreni

Consegna del **6 ottobre 2026** su `feat/data-expansion`, base `a615c97` (PR #13). Nessun push, merge o deploy. Ricerca completa: [land-data-2.md](../research/land-data-2.md). Richieste, timestamp, risposte/hash, CORS e ripetizioni curl: [manifest](../research/evidence/land-data-2/manifest.json). Fixture e riduzioni dichiarate: `tests/fixtures/manifest.json`.

## Verifiche

| Comando / verifica | Esito |
|---|---|
| `npm run lint` | PASS, zero warning |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 78 test offline |
| `npm run build` | PASS, Next.js 16.3.8 |
| `npm run test:live` | **FAIL**, exit 1: prima serie 63 PASS, 5 PARTIAL, 4 FAIL; espansione/benchmark successivi 0 FAIL, 4 PARTIAL |
| Punto AdE richiesto | PASS, HTTP 200, `it:D612:_:50:1102` |
| `git diff --check` | PASS |

I quattro FAIL della prima serie sono `power-grid`, `infrastructure-distances`, `industrial-sites` e il preesistente `services` a Bagno a Ripoli: indisponibilità Overpass. Non sono stati soppressi. Nella successiva serie in processi nuovi i tre nuovi layer OSM rispondono su tutti i lotti; altre richieste OSM preesistenti incontrano ancora 504/429/timeout. Le risposte intermittenti non autorizzano una promessa di disponibilità commerciale del server pubblico. Fixture offline non sostituiscono dati live.

Test significativi: payload reali in due regioni, tensioni esplicite/mancanti, HTTP 200 con remark, geometrie mancanti, vuoti completi, distanza dal confine e intersezione, query condivisa, guardia produzione, classi regionali/anni, retry AdE e tipo di errore preservato nella cache, aspect noto/quasi piano, deadline di layer, abort di singolo/ultimo chiamante e coda del limiter.

## Matrice live e benchmark

Esecuzione finale benchmark: `2026-10-05T23:43:35.994Z` (6 ottobre in Italia). Ogni lotto in un processo nuovo; due chiamate al route handler report con `at`, fredde poi calde. Include risoluzione catastale; esclude startup Next, trasporto HTTP e rendering. Cache locale in memoria. Non è una misura di latenza del sito distribuito.

| Lotto reale / contesto | Regione | Freddo | Caldo | Rete elettrica | Infrastrutture | Siti industriali/cave/discariche | Uso regionale | Terreno |
|---|---|---:|---:|---|---|---|---|---|
| `it:F205:_:390:61`, Milano urbano | Lombardia | 20.155 ms | 13 ms | partial | ok | empty | ok, DUSAF 12111 | ok |
| `it:A564:_:60:110`, Bagno agricolo | Toscana | 24.354 ms | 7 ms | partial | ok | ok | empty | ok |
| `it:H222:_:28:60`, Vallombrosa montano | Toscana | 17.449 ms | 10 ms | partial | ok | empty | empty | partial |

`empty`: query riuscita senza elementi sul punto/nell'intorno, non inesistenza del fenomeno. `partial` rete: tensioni non interpretabili in 31, 5 e 3 linee della ricerca; queste linee non vengono classificate AT. `partial` terreno a Vallombrosa: una sola quota valida, nessuna pendenza/aspect calcolata. I report caldi conservano per il TTL anche stati parziali/negativi, quindi velocità non significa completezza.

| Dato reale restituito | Milano | Bagno | Vallombrosa |
|---|---:|---:|---:|
| Linea censita con tensione ≥132 kV: distanza dal confine | 2.958 m | 1.275 m | 8.854 m |
| Stazione elettrica censita più vicina | 1.140 m | 4.912 m | 78 m |
| Stazione con tensione dichiarata ≥132 kV | 1.140 m | 4.912 m | 9.986 m |
| Aspect medio stimato | 145,8° | 183,2° | null |
| Quota di superficie rivolta a sud | null | null | null |

Una stazione OSM non certifica una cabina primaria. Distanze, tensioni dichiarate e orientamento non attestano fattibilità, potenza disponibile o idoneità legale FER.

UCS Toscana e DUSAF Lombardia sono verificate anche su sei punti di ricerca: Firenze/Bagno/Vallombrosa e Milano/Lodigiano/Valsassina. Il controllo supplementare finale del provider restituisce `ok` su Firenze (111), Lodigiano (213), Valsassina (31111). A Bagno la query originale UCS sul punto di ricerca è positiva (210); il punto rappresentativo interno della particella risolta dal report restituisce invece un vuoto. Nessun valore viene trasferito dal primo punto al secondo.

### Isolamento e limiti host

Provider in parallelo, deadline layer 25 s. Nuova ricerca OSM: budget HTTP 22 s comprensivo di coda, corpo e massimo un retry HTTP; uso regionale 12 s. Una query condivisa fra i tre nuovi provider. Altre query OSM dei layer preesistenti rimangono distinte.

Nella strumentazione reale Overpass: massimo 1 richiesta in volo; intervallo minimo fra avvii Milano 12.704 ms, Bagno 7.300 ms, Vallombrosa 5.001 ms (limite configurato 5 s). Per AdE: massimo 1 richiesta in volo, intervalli minimi 501/501/500 ms. Abort dell'ultimo chiamante libera la richiesta e lo slot; abort di uno dei chiamanti condivisi non interrompe gli altri. Cache/dedupe/limiter per processo, nessuna quota distribuita fra istanze.

## Fonti ammesse ed escluse

| Fonte | Implementata | Motivo e condizioni |
|---|---|---|
| MASE/GSE PAI, criteri legali FER | No | Accesso PAI riservato; API pubblica/licenza/vigenza regionale non qualificate. Nessuna regola automatica di idoneità |
| Terna geometrie / GSE aree cabine CER | No | API geometriche Terna non verificate; aree CER non sono ubicazioni fisiche/capacità di cabine |
| OSM rete elettrica | Sì | Geometrie complete verificate su urbano/agricolo/montano in due regioni; ODbL 1.0 |
| Catasti incendi / EFFIS | No | Catasto regionale non qualificato in due regioni; archivio EFFIS con bbox anomala e nessun positivo confermato |
| Vincolo idrogeologico Toscana/Piemonte | No | Toscana positivo reale ma licenza specifica da confermare; Piemonte solo vuoti osservati |
| LCC Toscana / ESDAC | No | Toscana interrogata ma licenza/seconda regione non qualificate; ESDAC non equivale a LCC del lotto |
| UCS Toscana 2019 / DUSAF Lombardia 7.0, 2021 | Sì | Tre punti per regione; UCS CC BY senza versione indicata, DUSAF CC BY 4.0; scope point |
| ISPRA consumo di suolo 10 m | No | Raster interrogabile del lotto non qualificato; catalogo suolo richiede token, statistiche territoriali non equivalenti |
| SISBON / PSC-AGISCO | No | Query geospaziale pubblica/licenza non qualificate |
| OSM cave/discariche/industria | Sì | Censimento reale, ODbL; non contaminazione, bonifica o dismissione certificata |
| OSM strade/ferrovie/cimiteri/pozzi | Sì | Distanze geometriche, ODbL; nessuna fascia legale |
| TINITALY / EU-DEM già usati | Esteso | Aspect esplicitamente stimato dai campioni; percentuale a sud null |
| BUL/Infratel | No | Endpoint legacy non risponde; copertura al lotto/licenza attuale non verificate |

OSM commerciale: dati ODbL con attribuzione e relativi obblighi; le condizioni dell'hosting sono separate. I nuovi layer sono esclusi in produzione se `OVERPASS_URL` punta ai server pubblici de/kumi: serve un servizio dedicato/contrattualizzato. Licenze ancora da chiarire per vincolo toscano, LCC, siti contaminati, catasti incendi e BUL; nessuna di queste risorse è integrata.

## Contratto e debug

Additivi: `LayerId` `power-grid`, `infrastructure-distances`, `industrial-sites`, `regional-land-cover`; `LayerGroup` `energia`; report da 13 a 17 layer, fonti catalogate da 24 a 26. Catalogo core, registry IT, contenuto e `GROUP_LABEL` allineati. `terrain` aggiunge `aspect_estimate` e `south_facing_share`; quest'ultima resta null. Schemi/campi preesistenti non rimossi. Chi valida liste chiuse di ID/gruppi deve accettare le nuove voci.

Regressione AdE: parcel WFS valido ma zoning WFS sulla bbox ±0.0001° risponde HTTP 200 con `ServiceException InvalidFormat`, «Richiesta non valida». Il secondo tentativo ±0.00002° sullo stesso punto restituisce i fogli reali; foglio e geometria vengono comunque verificati. Retry solo per ExceptionReport/HTML, due finestre totali; se falliscono entrambe, messaggio chiaro e 502. Nessuna particella più vicina o identità inventata.

Nessuna percentuale impermeabilizzata, quota areale a sud, esito catastale di incendio, idoneità normativa o capacità di connessione viene riempita da stime o dalla sola assenza di dati.
