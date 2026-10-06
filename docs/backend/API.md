# API v1

Runtime Node.js, stesso dominio dello Studio. Le risposte JSON sono validate con il contratto zod condiviso. Avvio: `npm run dev`; per la produzione leggere gli override e le quote in ARCHITECTURE.md.

## Endpoint

| Metodo e percorso                         | Input                                               | Risposta                                    |
| ----------------------------------------- | --------------------------------------------------- | ------------------------------------------- |
| POST `/api/v1/lots`                       | `{parcels:[{id, at?:{lat,lon}}]}` (2–20)            | Plot composto                               |
| GET `/api/v1/health`                      | nessuno                                             | Health, sola vitalità                       |
| GET `/api/v1/geocode`                     | `q` 3–200 caratteri; `country=it` facoltativo       | GeocodeResult[]                             |
| GET `/api/v1/plots/at`                    | `lat`, `lon`; `country=it` facoltativo              | Plot                                        |
| GET `/api/v1/plots/{id}`                  | `at=lat,lon` facoltativo, raccomandato sempre       | Plot                                        |
| GET `/api/v1/plots/{id}/layers/{layer}`   | LayerId; stesso `at`                                | LayerResult                                 |
| GET `/api/v1/plots/{id}/report`           | stesso `at`                                         | PlotReport con 17 layer                     |
| GET `/api/v1/catalog/layers`              | nessuno                                             | 17 LayerCatalogEntry                        |
| GET `/api/v1/catalog/sources`             | nessuno                                             | SourceCatalogEntry[]                        |
| GET `/api/v1/tiles/{overlay}/{z}/{x}/{y}` | allowlist `cadastre`, `flood`, `landslide`; z 0..22 | PNG trasparente 256×256                     |
| POST `/api/v1/studio/chat`                | `{id, messages: UIMessage[], plotId, at?}`          | UI message stream AI SDK 7, oppure ApiError |

Parametri sconosciuti/ripetuti nelle query validate: 400. Coordinate vuote, non finite o fuori intervallo: 400. ID: `it:Belfiore:sezione_o_:foglio:particella`. `at` è una coppia decimale latitudine,longitudine; il frontend invia sei decimali. Sono ammessi anche meno decimali. Ordine GeoJSON invece **lon,lat**.

## Lotto freddo, layer e Scheda

Tutte le route da ID usano `resolvePlot(id, at)`:

1. Validazione di ID e punto, anche con cache calda.
2. Se il lotto è in cache, riuso della particella confermata.
3. Con cache fredda e `at`, `plotAt(at)` individua la geometria che contiene il punto. L’ID deve coincidere esattamente.
4. Se non coincide: HTTP 404 `not_found`, messaggio **“Il punto indicato non ricade nella particella richiesta.”**
5. Senza `at`, indice completo del download comunale AdE (estratto in streaming dallo ZIP regionale), poi geometria confermata live tramite WFS bbox. Cache fredda: fino a 180 s per il download, route con `maxDuration=300`; hosting compatibile o indice preparato prima. Un vuoto live non confermato resta 502; un foglio/particella assente dal download è 404 con timestamp e limite esplicito.

Un errore negativo della ricerca per ID non blocca una nuova risoluzione con `at`. Il punto non sceglie il lotto più vicino. Strade/acque e ambiguità di confine conservano gli errori esistenti.

Per un Server Component, senza HTTP verso la propria app:

```ts
import { getPlotReport } from "#server/plots.ts";

// /scheda/[id]?at=43.769270,11.256500
const { id } = await params;
const { at } = await searchParams;
const report = await getPlotReport(id, at);
```

Il modulo espone anche `resolvePlot` e `getPlotLayer`. La pagina Scheda è di competenza del frontend: il backend fornisce il modulo importabile, non modifica la UI.

```bash
curl -sS 'http://localhost:3000/api/v1/health'
curl -sS 'http://localhost:3000/api/v1/geocode?q=Via%20Tortona%2031%20Milano'
curl -sS 'http://localhost:3000/api/v1/plots/at?lat=43.769270&lon=11.256500'
curl -sS 'http://localhost:3000/api/v1/plots/it:D612:_:173:68?at=43.769270,11.256500'
curl -sS 'http://localhost:3000/api/v1/plots/it:D612:_:173:68/layers/planning?at=43.769270,11.256500'
curl -sS 'http://localhost:3000/api/v1/plots/it:D612:_:173:68/report?at=43.769270,11.256500'
curl -sS 'http://localhost:3000/api/v1/tiles/cadastre/18/139314/95623' -o /tmp/cadastre.png
```

Geocoding: Nominatim con fallback Photon su errore, rate limit o vuoto. Nomi/civici sono conservati, compreso “Via Tortona 31”. Verificati live anche “Bagno a Ripoli” e “Piazza della Signoria Firenze”. Le query catastali vengono risolte prima del geocoder: `Firenze, foglio 150B, particella 782`, `F. 12 p. 340 Bergamo`, `fg 12 mapp 340 comune di Bergamo`, sezione facoltativa. Il risultato è `GeocodeResult` con `kind="parcel"`, ID esatto, `center` strettamente interno, bbox e provenienze. Comune ambiguo → 400 con opzioni; foglio/particella assenti dal download dichiarato → 404; download/geometria live non confermati → 502. Il Comune catastale può differire da quello amministrativo: il risultato dichiara entrambi quando necessario; `Plot.cadastral.municipalityCode` identifica il catasto, `Plot.municipality` i confini ISTAT del punto. Lo snapshot CSV ISTAT scaricato live contiene 7.896 righe ed è più vecchio di SITUAS: dettagli, misure e limiti in [cadastral-search.md](../research/cadastral-search.md). In produzione Nominatim pubblico richiede hosting singolo/limiter globale; vedere ARCHITECTURE.md. Nessun autocomplete sul servizio pubblico.

## Lotto composto e URL condiviso

`POST /api/v1/lots` restituisce un `Plot` aggregato. Non crea una risorsa con ID opaco né richiede persistenza centrale. Esempio con due particelle reali di Bagno a Ripoli:

```json
{ "parcels": [{ "id": "it:A564:_:60:109" }, { "id": "it:A564:_:60:110" }] }
```

È raccomandato includere `at:{lat,lon}` di ogni componente (coordinate della ricerca/Plot), per evitare il download su un'altra istanza. Identificativi e coordinate vengono verificati; stesso Belfiore, eventuali Comuni ISTAT concordi, 2–20 particelle distinte, niente aggregati annidati. Violazioni → 400. L'ID restituito è ordinato: `it:A564:_:60:109+it:A564:_:60:110`. Codificare l'ID con `encodeURIComponent` nei percorsi.

Estensioni additive di `Plot`: `parcels:[{id,at,cadastral}]`, `representativePointMethod:"interior-point"`. I precedenti campi restano disponibili; per un lotto `cadastral.sheet` e `cadastral.parcel` sono elenchi e `cadastral.label` è, ad esempio, `Foglio 60 · Particelle 109, 110`. Usare `parcels[]` per gli identificativi singoli. `geometry` è sempre la MultiPolygon dell'unione (anche se contigua), `areaM2` e `perimeterM` misurano l'unione senza sommare confini condivisi. `centroid` è un punto strettamente interno dichiarato, non un baricentro. La provenienza dell'unione è `computed`, non ufficiale.

Tutte le route GET esistenti e `/scheda/{id}` accettano l'ID composto. `at` è `lat1,lon1;lat2,lon2` **nell'ordine degli ID del percorso**; il server verifica numero/formato dei punti e corrispondenza con i singoli ID. Con solo ID, i componenti sono risolti tramite gli indici. I provider ricevono l'intera geometria unita; quelli puntuali usano `centroid`, con nota esplicita. Le parti disgiunte sono ammesse e un risultato puntuale non è generalizzato a tutte le parti. Copertura e limiti delle fonti mantengono `partial`, `outside_coverage`, `unavailable`.

Helper frontend additivi:

```ts
const lot = await api.lot({ parcels: selected.map((p) => ({ id: p.id, at: p.centroid })) });
const points = lot.parcels!.map((p) => p.at);
const link = reportHref(lot.id, points); // /scheda/<ID codificato>?at=…;…
const result = await api.layer(lot.id, "flood", points);
```

Il selettore multiplo nello Studio non è aggiunto da questa sessione backend; API, helper, Scheda e provider sono predisposti. La verifica live di POST/GET e dei 17 layer è in `verification/session-e-live.json`; la verifica ripetibile di questa sessione è `npm run test:live -- --cadastral` (sei ricerche in sei regioni, apertura spaziale, lotto e layer). I fallimenti/disponibilità parziali delle fonti restano registrati.

## Risposte reali abbreviate

Estratti acquisiti il 6 ottobre 2026, ora italiana. I timestamp UTC possono essere del 5 ottobre. Sono abbreviati e non vanno passati direttamente a `.parse`. Il JSON completo generato per la landing è in `src/content/hero-example.json`.

```json
{
  "id": "it:D612:_:173:68",
  "cadastral": { "sheet": "173", "parcel": "68", "label": "Foglio 173 · Particella 68" },
  "municipality": { "istatCode": "048017", "name": "Firenze", "province": "Firenze", "provinceCode": "FI" },
  "areaM2": 6374.608410795467
}
```

Area geodetica della geometria restituita, non superficie censuaria. Ogni Plot contiene geometry, centroid (punto interno rappresentativo), perimeterM, dati nullable e provenienze AdE/ISTAT. I nomi dataset sono brevi e leggibili: “Cartografia catastale — particelle”, “Mappe catastali — fogli”. `provinceCode` è una **sigla di due lettere**, mai il numero ISTAT.

```json
{
  "layer": "planning",
  "status": "ok",
  "scope": "point",
  "headline": "Il punto è nell’ambito del nucleo storico (zona A - sottozona A1)."
}
```

```json
{
  "layer": "market",
  "status": "ok",
  "scope": "zone",
  "headline": "Nella zona OMI B5, abitazioni civili da 3600 a 5300 €/m².",
  "metrics": [
    { "key": "semester", "value": "2025/2" },
    { "key": "residential-0-min", "value": 3600, "unit": "€/m²", "hint": "Superficie lorda" },
    { "key": "residential-0-max", "value": 5300, "unit": "€/m²" }
  ]
}
```

Quotazioni di zona per abitazioni, **non prezzo del lotto**. Il semestre si legge dalla fonte ad ogni scadenza della cache, senza hardcoding dell’anno.

## Layer e significato

Ogni LayerResult contiene titolo/gruppo, status, scope, headline, severity, metrics, features nullable, overlays, legend, notes, method opzionale, provenance e computedAt. `notes` è italiano per non tecnici; `method` contiene servizio, campionamento, CRS e dettagli riproducibili. Il campo era già nel contratto: nessuna modifica di schema in questa sessione.

| Layer             | Fonte e copertura                                                | Scope / limite                                                                                         |
| ----------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| flood / landslide | ISPRA IdroGEO PAI e IFFI                                         | `point`; verifica puntuale, non tutto il lotto                                                         |
| seismic           | DPC maggio 2025 / INGV MPS04                                     | `municipality`; PGA del modello vicina al punto, non rilievo                                           |
| protected-areas   | EEA Natura 2000 / NatDA                                          | `parcel` con geometria, altrimenti `buffer`; entro 1 km                                                |
| landscape         | MiC SITAP, art. 136 e categorie art. 142 disponibili per regione | `point`; inventario non esaustivo né certificativo; licenza non accertata                              |
| planning          | PO ambiti vigenti Firenze, CC BY 4.0; sintesi PGT Milano         | `point`; norme/tavole ulteriori da consultare; licenza PGT non accertata                               |
| land-cover        | EEA/Copernicus CORINE 2018                                       | `parcel` con stima sui punti, altrimenti `point`; scala 1:100000, impermeabilizzazione non disponibile |
| terrain           | INGV TINITALY, fallback EU-DEM                                   | `parcel`/`point`; quote e pendenza stimate                                                             |
| solar             | JRC PVGIS 5.3                                                    | `point`; simulazione ideale da 1 kWp                                                                   |
| services          | Overpass/OpenStreetMap                                           | `buffer`; inventario incompleto, 500 m/1 km, distanze in linea d’aria                                  |
| accessibility     | Valhalla/FOSSGIS + stessa richiesta Overpass                     | `buffer`; classKey `walk-10`, `car-10`; servizi cercati solo entro 1 km                                |
| demographics      | ISTAT 2021 / stima comunale 2026                                 | `grid_cell`; non residenti del lotto                                                                   |
| market            | AdE OMI                                                          | `zone`; perimetri KML, min/max residenziale, stato e superficie L/N                                    |

Fuori Firenze/Milano `planning` risponde `outside_coverage`: il piano comunale non è collegato, con indicazioni del Comune/geoportale regionale noto. Anche i provider non collegati o non configurati usano `outside_coverage`. Un guasto transitorio conserva `unavailable`. `empty` significa che la fonte ha risposto senza oggetti: non assenza di rischio. Un report può essere HTTP 200 anche con singoli layer indisponibili.

Il tile catastale elimina il riempimento crema vicino a RGB 253/236/189, mantenendo linee, numeri e filigrana/attribuzione. Il test usa una PNG reale. Overlay arbitrari e URL upstream scelti dall’utente non sono ammessi.

## Chat

```bash
curl -N -X POST 'http://localhost:3000/api/v1/studio/chat' \
  -H 'Content-Type: application/json' \
  -d '{"id":"conversation-1","plotId":"it:D612:_:173:68","at":"43.769270,11.256500","messages":[{"id":"question-1","role":"user","parts":[{"type":"text","text":"Quali verifiche urbanistiche servono?"}]}]}'
```

Compatibile con `DefaultChatTransport` e `body: {plotId}`. `at` è un’estensione facoltativa: per una chat su un’istanza fredda è raccomandato passare anche il punto, per evitare la costruzione dell’indice comunale. Per lotti composti accetta l’ID unito e `at` con un punto per componente separato da `;`; nessuna coordinata è inventata dall’ID.

Limiti: body 64 KiB, massimo 24 messaggi, 40 parti per messaggio, 6.000 caratteri per parte testuale e 32.000 totali. Solo ruoli user/assistant; messaggi utente solo testo. Risultati tool/reasoning ricevuti dal browser non vengono riprodotti come prove al modello. Il primo passo chiama obbligatoriamente `getPlot`; massimo 6 passi, 900 token di output per passo, timeout 90 s (maxDuration route 120 s). Tool server: `getPlot({})`, `listLayers({})`, `getLayer({layer: LayerId})`. Output senza geometrie e con fonti/metriche/note.

Modello `PARTICELLA_CHAT_MODEL`, default `anthropic/claude-sonnet-5-5`, forma `provider/modello`. Autenticazione `AI_GATEWAY_API_KEY` oppure OIDC Vercel dal contesto runtime/`VERCEL_OIDC_TOKEN`. Se assente: HTTP 503 `not_configured`, nessuna richiesta al modello. Rate limit locale: 8 richieste/minuto per IP, 429 `rate_limited`. Gli errori dopo l’avvio dello stream sono eventi SDK con messaggio italiano privo di dettagli sensibili.

Le istruzioni richiedono solo dati dei tool, ente e dataset per ogni affermazione, distinzione degli stati e nessuna conclusione definitiva di edificabilità. Comune, certificato di destinazione urbanistica e tecnico abilitato restano verifiche necessarie. Il modello non è stato chiamato live: lo streaming è verificato offline con un modello finto AI SDK 7.

## Errori e cache HTTP

| HTTP | error.code           | Caso                                                                           |
| ---- | -------------------- | ------------------------------------------------------------------------------ |
| 400  | bad_request          | input non valido, ID/at/query duplicati, ambiguità di selezione                |
| 404  | not_found            | nessun lotto, strada/acqua, punto di altra particella, catasto fuori copertura |
| 429  | rate_limited         | quota temporanea; header Retry-After                                           |
| 502  | upstream_unavailable | errore remoto, timeout, protocollo, lookup per attributi non confermato        |
| 503  | not_configured       | chat/paese non configurato                                                     |
| 500  | internal             | errore interno o risposta non conforme                                         |

Envelope `{ "error": { "code": "…", "message": "…" } }`. Errori e risultati parziali sono no-store. Cache pubblica: geocode/layer/lotto 3600 s, report completo 300 s, cataloghi 86400 s, tile 604800 s. Chat e health no-store. Tutte le risposte includono nosniff.

`npm run test:live` esegue route e provider reali su Firenze, Duomo Milano e Bagno a Ripoli; scrive `tests/live-results.json` generato. Il risultato locale dei controlli e quello di rete sono distinti. Leggere anche `verification/SESSION-B.md` per esiti e limiti.

OMI può pubblicare quotazioni residenziali senza dichiarare una tipologia prevalente: in quel caso il livello è `partial` e mostra tutte le tipologie disponibili, senza attribuire una prevalenza. Se non pubblica prezzi residenziali, lo stato è `empty`, mantenendo la zona e il semestre. La fixture reale rurale registra questo caso.

## Sessione C: dati dei terreni

Il catalogo e il report includono 17 layer. Nuovi identificativi additivi:

| Layer                      | Gruppo        | Scope    | Fonte                                                                  |
| -------------------------- | ------------- | -------- | ---------------------------------------------------------------------- |
| `power-grid`               | `energia`     | `buffer` | OSM: geometrie di linee con `voltage` ≥132000 V e stazioni entro 10 km |
| `industrial-sites`         | `energia`     | `buffer` | OSM: aree industriali, cave e discariche entro 2 km                    |
| `infrastructure-distances` | `urbanistica` | `buffer` | OSM: strade principali, ferrovie, cimiteri e pozzi entro 2 km          |
| `regional-land-cover`      | `ambiente`    | `point`  | UCS Toscana 2019 / DUSAF Lombardia 7.0 (2021)                          |

Esempi su un vero lotto urbano milanese, con `at` necessario a cache fredda:

```sh
curl 'http://localhost:3000/api/v1/plots/it:F205:_:390:61/layers/power-grid?at=45.464800,9.191000'
curl 'http://localhost:3000/api/v1/plots/it:F205:_:390:61/layers/regional-land-cover?at=45.464800,9.191000'
curl 'http://localhost:3000/api/v1/plots/it:F205:_:390:61/report?at=45.464800,9.191000'
curl 'http://localhost:3000/api/v1/plots/at?lat=43.7865&lon=11.2010'
```

Le distanze OSM si riferiscono al confine catastale quando disponibile, altrimenti al punto rappresentativo: non sono percorsi o fasce legali. `grid-line-nearest`, `substation-nearest`, `hv-substation-nearest` sono distanze degli elementi censiti; `null` non significa zero né distanza illimitata. Nessun dato di capacità o connessione. `partial` segnala tensioni non interpretabili o geometrie mancanti; un errore Overpass non diventa `empty`. I tre layer condividono una query, una sola cache HTTP e il limiter della fonte. I server pubblici Overpass restano esclusi in produzione commerciale.

Il layer regionale non estende CORINE né ne modifica la semantica: è separato, con scope `point`, anno e codice della propria carta. Altri territori: `outside_coverage`. Nessuna percentuale impermeabilizzata dal codice di uso del suolo.

`terrain.metrics` aggiunge `aspect_estimate` (azimut medio stimato di discesa, gradi in senso orario da nord) e `south_facing_share` (`null`, percentuale areale non calcolabile con il metodo attuale). Aspect `null` sotto 0,5% di pendenza o con geometria/campioni insufficienti. Nessuna modifica dei valori preesistenti.

Il punto di regressione AdE ora restituisce `it:D612:_:50:1102`: in caso di ExceptionReport/HTML la query spaziale tenta una sola bbox più piccola sullo stesso punto, verificando comunque geometria e foglio reali. Se entrambi i tentativi falliscono, 502 `upstream_unavailable` con messaggio comprensibile.
