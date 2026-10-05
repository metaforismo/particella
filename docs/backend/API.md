# API v1

GET, stesso dominio del frontend, runtime Node.js. JSON validato dal contratto zod condiviso. Non richiede autenticazione; le quote delle fonti restano applicate. Avvio locale: `npm run dev`, oppure `npm run build && npm start` con configurazione di produzione appropriata.

## Endpoint

| Percorso                              | Parametri                                              | Risposta                                                   |
| ------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| `/api/v1/health`                      | nessuno                                                | Health; sola vitalità dell'app                             |
| `/api/v1/geocode`                     | `q` 3–200 caratteri; `country=it` opzionale            | GeocodeResult[]                                            |
| `/api/v1/plots/at`                    | `lat` -90..90, `lon` -180..180; `country=it` opzionale | Plot oppure errore                                         |
| `/api/v1/plots/{id}`                  | ID catastale reversibile                               | Plot; verificare il supporto live del lookup a cache vuota |
| `/api/v1/plots/{id}/layers/{layer}`   | LayerId del contratto                                  | LayerResult                                                |
| `/api/v1/plots/{id}/report`           | ID catastale                                           | PlotReport con otto layer paralleli                        |
| `/api/v1/catalog/layers`              | nessuno                                                | LayerCatalogEntry[]; otto layer implementati               |
| `/api/v1/catalog/sources`             | nessuno                                                | SourceCatalogEntry[]                                       |
| `/api/v1/tiles/{overlay}/{z}/{x}/{y}` | overlay allowlist, z 0..22, x/y nella griglia          | PNG 256×256                                                |

I parametri query ripetuti o sconosciuti nelle query validate sono 400. Coordinate vuote, NaN, infinite o fuori intervallo non sono accettate. Geocode usa Nominatim con fallback Photon. `foglio 12 particella 340 Bergamo` produce 400 con istruzioni per usare un ID: la risoluzione del nome comune verso Belfiore non è implementata. Anche i layer del contratto previsti nella prossima fase rispondono con `unavailable`, senza simulare dati.

```bash
curl -sS 'http://localhost:3000/api/v1/health'
curl -sS 'http://localhost:3000/api/v1/geocode?q=Piazza%20Duomo%20Milano'
curl -sS 'http://localhost:3000/api/v1/plots/at?lat=43.7&lon=11.32'
curl -sS 'http://localhost:3000/api/v1/plots/it:A564:_:60:110'
curl -sS 'http://localhost:3000/api/v1/plots/it:A564:_:60:110/layers/flood'
curl -sS 'http://localhost:3000/api/v1/plots/it:A564:_:60:110/report'
curl -sS 'http://localhost:3000/api/v1/catalog/layers'
curl -sS 'http://localhost:3000/api/v1/catalog/sources'
curl -sS 'http://localhost:3000/api/v1/tiles/cadastre/16/34828/23905' -o cadastre.png
```

Per gli altri tile sostituire `cadastre` con `flood` o `landslide`. Template frontend esatto: `/api/v1/tiles/cadastre/{z}/{x}/{y}`. Rimuovere il PNG locale dopo la prova se non serve conservarlo. Non usare endpoint pubblici Nominatim per autocomplete; in produzione vedere le condizioni in ARCHITECTURE.md.

## Risposte reali abbreviate

Gli estratti omettono campi per leggibilità e non sono payload completi da passare a `.parse`. Provengono dalle chiamate live del 6 ottobre 2026, ora italiana; i timestamp UTC possono essere ancora del 5 ottobre. Il dettaglio è in `tests/live-results.json`.

Lotto rurale Bagno a Ripoli:

```json
{
  "id": "it:A564:_:60:110",
  "country": "it",
  "cadastral": {
    "municipalityCode": "A564",
    "section": null,
    "sheet": "60",
    "parcel": "110",
    "label": "Foglio 60 · Particella 110"
  },
  "municipality": { "istatCode": "048001", "cadastralCode": "A564", "name": "Bagno a Ripoli" },
  "areaM2": 18665.20448761215
}
```

La risposta completa include geometria GeoJSON lon/lat, punto rappresentativo, perimetro, indirizzo nullable e provenance AdE/ISTAT. L'area è misurata sulla geometria restituita, non attestata dal catasto.

Milano Duomo ricade su una strada, quindi:

```json
{
  "error": {
    "code": "not_found",
    "message": "Il punto ricade su una strada o un'acqua catastale: non è un lotto."
  }
}
```

Popolazione della cella rurale:

```json
{
  "layer": "demographics",
  "status": "ok",
  "scope": "grid_cell",
  "headline": "Nel 2021 la cella di un chilometro quadrato contava 99 residenti.",
  "metrics": [
    { "key": "grid_population", "label": "Residenti nella cella nel 2021", "value": 99, "unit": "residenti" }
  ]
}
```

Un report completo ha `{plot, layers, generatedAt}`. Ogni layer include gruppo, titolo, stato, scala, frase di sintesi, severity, metriche, feature nullable, overlay, legenda, note, provenienza e computedAt. Un timeout mantiene HTTP 200 del report con quel layer `unavailable`; un errore nel recupero del lotto impedisce invece il report.

## Errori e cache HTTP

| HTTP | `error.code`         | Caso                                                   |
| ---- | -------------------- | ------------------------------------------------------ |
| 400  | bad_request          | query/ID/overlay invalido, selezione catastale ambigua |
| 404  | not_found            | nessun lotto, strada/acqua, fuori copertura catasto    |
| 429  | rate_limited         | quota o cooldown; `Retry-After: 30`                    |
| 502  | upstream_unavailable | timeout, eccezione OGC, errore HTTP/protocollo remoto  |
| 503  | not_configured       | paese o hosting richiesto non configurato              |
| 500  | internal             | errore interno o payload di risposta non conforme      |

L'envelope è sempre `{ "error": { "code": "…", "message": "…" } }`. Le risposte di errore e quelle parziali sono `no-store`. Cache pubblica: geocode/layer 3600 s, lotto 3600 s, report completo 300 s, cataloghi 86400 s, tile 604800 s. Health non prova che le fonti esterne siano disponibili. Tutte le risposte includono `X-Content-Type-Options: nosniff`.

## Limiti

L'Italia è il solo paese attuale. Catasto AdE esclude Trento/Bolzano. Il lookup da ID a cache vuota non ha superato la prova live: il filtro WFS sul foglio noto restituisce un vuoto con conteggio ignoto e il backend risponde 502 `upstream_unavailable`. Richiede un lookup ufficiale verificato o un indice condiviso. leggere l'ultimo esito live e non confondere la prova con fixture con una verifica remota. La cache è locale al processo, quindi un lookup riuscito dopo `plots/at` su una singola istanza non dimostra il funzionamento su istanze Vercel diverse.

IdroGEO è uno screening del punto, non un'intersezione di tutto il lotto. I vuoti non certificano assenza di rischi/vincoli. Classificazione DPC e popolazione comunale sono snapshot, non refresh in tempo reale; popolazione comunale iniziale limitata ai soli comuni Milano e Firenze. Quote/pendenza e PVGIS sono stime da modello. Servizi OSM non sono un elenco ufficiale o completo. Urbanistica e atti locali non rientrano in questa fase.
