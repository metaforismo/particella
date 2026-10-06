# Backend Particella

TypeScript nel runtime Node.js di Next.js 16.3.8, frontend e backend nello stesso progetto. Nessun Edge, database o import massivo. La ricerca iniziale è in `docs/research/`.

## Moduli e flusso

- `src/lib/contracts/index.ts`: zod v4 condiviso; nessuna modifica nella sessione B. `LayerResult.method` era già presente.
- `src/server/core/`: cache, HTTP/quote, errori, provenienza, catalogo fonti/layer e isolamento dei provider. Nessuna semantica catastale italiana.
- `src/server/geo/`: GML/GeoJSON, assi, geometrie, copertura del punto, aree/perimetri geodetici, distanze, campioni e Mercator.
- `src/server/countries/it/`: catasto/comuni, geocoder e 13 provider, protocolli italiani.
- `src/server/plots.ts`: ingresso condiviso `resolvePlot`, `getPlotLayer`, `getPlotReport`; importabile dai Server Component senza HTTP.
- `src/server/chat/`: validazione conversazione, limite IP, tool compatti, istruzioni italiane e streaming AI SDK 7.
- `src/server/http/`: query/body limitati, validazione risposta, cache HTTP ed error envelope.
- `src/app/api/v1/`: route Node.js con `RouteContext`/params Promise.
- `scripts/content/hero.ts`: generazione live della landing, sola eccezione autorizzata al contenuto frontend.

Gli import di backend/route/test/script usano gli subpath Node `#server/*` e `#contracts` del package.json. Funzionano con Node strip-types, TypeScript moduleResolution bundler e Next/Turbopack. I JSON snapshot mantengono import relativo con `with {type: "json"}`.

Input validato, acquisizione dai provider, normalizzazione e validazione zod al confine HTTP. Una risposta non conforme dà HTTP 500 `internal` e log senza payload/segreti. Gli errori sono validati con ApiError. I binari hanno schema PNG locale 256×256.

### Identità e risoluzione del lotto

`plotAt` controlla prima la copertura comunale ISTAT, una sola volta; quel risultato viene riusato nella costruzione del Plot. Interroga WFS AdE in una piccola bbox, analizza GML e sceglie solo il poligono coprente, mai il più vicino. Bordi inclusi, più poligoni coprenti → selezione ambigua. Strade/acque → 404. Foglio/sezione dal riferimento della mappa e `LABEL`, senza deduzioni dagli zeri. ID `it:Belfiore:sezione_o_:foglio:particella`.

`resolvePlot(id, at)` valida ID e punti prima della cache. Con punto usa la risoluzione spaziale e verifica l'ID; senza punto la sessione E usa il download AdE completo comunale per localizzare la bbox e conferma la geometria WFS live. Gli indici vengono estratti dal contenitore regionale in streaming, con limiti e cache disco. Un vuoto WFS non confermato resta 502; l'assenza nel download semestrale è dichiarata come tale. ID composto `id1+id2`: risoluzione dei componenti e unione MultiPolygon; `at` contiene un punto per componente separato da `;`. [Ricerca, misure e limiti](../research/cadastral-search.md), [contratto API](API.md).

Province: snapshot ufficiale ISTAT Province2026, 110 codici numerici→nome/sigla. Il codice numerico resta interno; la risposta Municipality contiene nome e sigla a due lettere. Provenienza dello snapshot aggiunta al Plot, senza cambiare lo schema.

Il report risolve il lotto una volta e lancia 13 layer in parallelo. Lotto: 25 s. Layer: 25 s con segnale e Promise di scadenza anche se il provider ignora l’abort. Guasti → `unavailable` del solo layer; copertura/implementazione/configurazione assente → `outside_coverage`. La route resta HTTP 200 quando il lotto è valido e un layer fallisce.

## Cache, rete e quote

`Cache` ha `get<T>`/`set<T>` asincroni, sostituibili con Redis. `MemoryCache` conserva copie, rimuove scaduti, applica LRU a numero e dimensione. Default **512 voci e 64 MiB**; `PARTICELLA_CACHE_MAX_BYTES` configura i byte. Una voce oltre il **25%** del budget non viene conservata. Conteggio con serialize V8 più peso della chiave; overhead degli oggetti JavaScript aggiuntivo e limitato dal numero di voci. Nessun file cache su disco. Risposta upstream massima 12 MB.

| Oggetto                   | TTL       |
| ------------------------- | --------- |
| HTTP/lotto/layer completo | 24 h      |
| Geocode                   | 30 giorni |
| PVGIS                     | 90 giorni |
| Tile WMS                  | 7 giorni  |
| Errori/risultati parziali | 30 s      |

Chiavi canoniche per oggetti/parametri. HTTP include metodo/body/header; layer include ID, hash geometria, centro e Comune. Namespace layer rivisto a ogni modifica del metodo. Deduplicazione sia HTTP che provider in corso; `retrievedAt` e `computedAt` mantengono la data originale dopo un hit. `referenceDate` non è data di acquisizione e resta null se ignota.

Timeout complessivo, User-Agent `Particella/0.1 (+https://github.com/metaforismo/particella)`, concorrenza e avvii per host. Retry solo su rete e 408/429/500/502/503/504, jitter/backoff, rispetto di Retry-After anche per nuove richieste. Redirect arbitrari bloccati. JSON sintatticamente invalido, eccezioni OGC e HTML inatteso respinti dal trasporto. **Campi JSON `status`, `remark`, `error` non sono errori universali**: gli adapter ArcGIS, Overpass, OpenTopoData ecc. validano lo schema della propria fonte. `HttpOptions.validate` permette un validatore di fonte prima della cache e anche sui cache hit/in-flight. OMI usa questa opzione per HTML previsto e verifica Comune/zona/semestre/tabella. La query posizionale legacy `?Comune/link/semestre/...` viene conservata: non va trasformata in un parametro URLSearchParams.

Le geometrie intere degli scenari IdroGEO possono superare 12 MB, pur con identify puntuale. Flood richiede con `propertyName` solo ID/scenario: risposta leggera, stessa classificazione al punto, geometria null e overlay raster dal proxy. Il metodo lo dichiara; non si scarica il poligono nazionale per mostrarlo come lotto.

Nominatim pubblico: 1/s, una richiesta in corso, ricerca esplicita, nessun autocomplete ([policy OSMF](https://operations.osmfoundation.org/policies/nominatim/)). In produzione serve `PARTICELLA_SINGLE_INSTANCE=1` per un singolo processo con limite globale; su Vercel geocoder proprio/proxy condiviso. Errori/vuoti Nominatim degradano su Photon; test offline specifico per 429. OpenTopoData: 1/s e 1000/giorno per processo. Overpass pubblico disabilitato in produzione: configurare hosting proprio/concordato. Valhalla FOSSGIS: 1/s e X-Client-Id, servizio demo senza SLA, niente uso pesante. Produzione distribuita richiede `VALHALLA_URL` dedicato/limiter condiviso; il default demo dà `outside_coverage` finché non configurato. Non sono stati inviati messaggi ai gestori.

I limiter e la deduplicazione sono locali al processo. Redis/limiter globale o hosting dedicato servono per scalare. Il limite chat per IP è anche locale: 8/minuto, mappa con al massimo 10.000 IP attivi e chiavi hash. Header IP affidabile solo dietro un proxy che lo sovrascrive. Non è una quota globale né un sistema di autenticazione.

Le URL di attribuzione pubblica sono separate dagli override privati. `requestUrl` elimina credenziali, token, chiavi e firme. Il catalogo non espone endpoint privati. Non stampare API key o token OIDC.

## Geometria e layer

GeoJSON lon/lat, GML AdE EPSG:6706 lat/lon. Proj4 normalizza gli assi con approssimazione di datum nulla verso WGS84. Nessuna trasformazione di epoca/griglia: precisione sub-metrica non garantita. Area/perimetro geodetici Turf, non superfici censuarie. I dettagli stanno qui e in `method`, non nei nomi dataset destinati all’utente.

| Layer             | Metodo / limiti                                                                                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| flood / landslide | WMS PAI P1/P2/P3 e P1–P4/AA; IFFI distinto. Punto rappresentativo, non intersezione integrale                                                                                                                                                         |
| seismic           | DPC per codice Comune; PGA nodo MPS04 più vicino nella bbox ±0,15°, senza interpolazione                                                                                                                                                              |
| protected-areas   | Geometrie EEA Natura2000/NatDA; contiene/interseca/vicino entro 1 km; distanza approssimata                                                                                                                                                           |
| landscape         | WMS SITAP art.136 e categorie art.142 regionali dell’inventario capabilities; identify sul punto. Non esaustivo, licenza non accertata                                                                                                                |
| planning          | Firenze: GML PO subsistemi/ambiti **vigenti**, non adottati, CC BY 4.0. Milano: layer REST 20 PGT Tavola Previsioni, sintesi non conformativa, licenza non accertata. Altri Comuni fuori copertura                                                    |
| land-cover        | Query CORINE intersecante il lotto, classe più frequente su griglia interna 4×4 più punto rappresentativo. Pari merito/punti scoperti → partial. 25 ha/100 m/1:100000, dati 2018; percentuale di campioni distinta da superficie/impermeabilizzazione |
| terrain           | TINITALY 10 m, fallback EU-DEM 25 m, fino a 17 punti interni. Pendenza da regressione di un piano; non pendenza massima                                                                                                                               |
| solar             | PVGIS 5.3, cristallino 1 kWp, perdite 14%, montaggio libero, angoli ottimali, orizzonte DEM. Ombre locali escluse                                                                                                                                     |
| services          | Overpass entro 1 km; categorie a 500 m/1 km; distanze geodetiche dal punto, centro bbox per way/relation                                                                                                                                              |
| accessibility     | Isocrone 10 min pedestrian/auto, GeoJSON `walk-10`/`car-10`, area geodetica. Join ai servizi attraverso runLayer, stessa richiesta/cache Overpass; conteggio limitato a 1 km                                                                          |
| demographics      | Cella ISTAT 2021 1 km² del punto; popolazione comunale 2026 solo dove importata                                                                                                                                                                       |
| market            | Ultimo semestre live OMI, perimetri ZIP/KML, point-in-polygon; elenco zona e prezzi HTML residenziali prevalenti, stato e L/N. Zona, non valore del lotto                                                                                             |

`empty` indica fonte riuscita senza oggetti; `outside_coverage` copertura mancante nota; `unavailable` guasto. Nessuno certifica edificabilità o assenza di rischio. Ogni fonte ha Provenance; legenda con classKey stabili. `notes` contiene limiti per non tecnici, `method` contiene dettagli tecnici. L’urbanistica richiede ancora NTA, ulteriori tavole/varianti e atti: l’ambito al punto non dà una conclusione legale di edificabilità. [Metadato ufficiale PO Firenze](https://opendata.comune.fi.it/page_dataset_show?id=po_subsistemi_e_ambiti-stato_vigente); [CORINE, scala e nomenclatura](https://land.copernicus.eu/en/products/corine-land-cover).

Tile: allowlist `cadastre`, `flood`, `landslide`. Bbox Mercator; AdE usa EPSG:6706 lat/lon e righe ricampionate a Mercator. Riempimento crema RGB 253/236/189, tolleranza 6 per canale, alpha azzerata; nero/rosso e altre tinte conservati. Test su PNG reale con confronto pixel. Zoom catasto sotto 12 → PNG trasparente. Nessuna URL upstream da input utente.

## Assistente

Implementazione sulla documentazione **installata AI SDK 7**, non API della versione 6: `instructions`, `isStepCount`, `result.stream`, `toUIMessageStream`, `createUIMessageStreamResponse`, `inputSchema` dei tool. `convertToModelMessages` è asincrona. Il package ai espone Gateway per stringhe `provider/modello`; `@vercel/oidc` è ora una dipendenza diretta per leggere il token dal contesto senza chiamate di refresh solo per verificare la configurazione.

Body limitato prima del parsing (64 KiB), schema zod e limiti su messaggi/parti/testo. Solo testo user/assistant arriva al modello: tool output del browser e reasoning vengono scartati. Primo passo forzato `getPlot`, poi solo tool chiusi sul plotId della richiesta: nessun tool permette URL arbitrari, query SQL o cambio di lotto. Sei passi, output 900 token per passo, aborto 90 s e request signal; maxDuration 120 s. Provider/cache identici alle route; strumenti non restituiscono geometrie grandi. Errori di stream mascherati in italiano.

Gateway auth: API key oppure token OIDC runtime/env. Assenza → 503 prima del modello. Modello configurabile e default richiesto `anthropic/claude-sonnet-5-5`: la sua disponibilità effettiva non è verificata senza una chiamata autenticata. Test offline con MockLanguageModelV4 verifica tool-loop e stream UI reale. Nessuna chiamata a pagamento è stata eseguita.

Le istruzioni impongono fonti per ogni affermazione, distinzione delle scale/stati, contenuti tool come dati e mai istruzioni. È un requisito del comportamento del modello, non una garanzia matematica: le risposte richiedono verifica umana per decisioni urbanistiche.

## Snapshot, contenuto e verifica

Snapshot piccoli: DPC, popolazione importata Milano/Firenze, province 2026, inventario layer SITAP. URL/data di acquisizione conservati; i file nuovi hanno hash della loro acquisizione nell’evidenza. `scripts/snapshots/refresh.ts` mantiene il refresh DPC/popolazione separato e non sovrascrive release esistenti. Nessun archivio nazionale o raster grande.

`npm run content:hero` risolve il punto 43.769270,11.256500 interno alla particella Firenze foglio 173, particella 68. Scrive esattamente `{plot,rows,apiSample}` in `src/content/hero-example.json`. Quattro righe reali ≤40 caratteri, preferenza urbanistica/alluvioni/sismica/sole, provenienza dal backend. L’apiSample è la stessa risposta Plot abbreviata; l’area è geometrica. Un provider mancante non viene sostituito con numeri finti.

`npm test`: offline, fixture reali più simulazioni esplicite per errori/cache/quote. `npm run test:live`: route e provider reali per Firenze, Milano Duomo (strada, smoke puntuale per i layer) e Bagno a Ripoli (lotto), cataloghi, geocode, cold at, mismatch, report, tile e chat 503. `tests/live-results.json` è generato e in gitignore; se era già tracciato deve essere rimosso dall’indice quando Git è scrivibile. Lo script esce 1 se una fonte fallisce; partial viene contato separatamente. Esiti della consegna in `verification/SESSION-B.md`.

Per aggiungere un layer: registrare fonte/condizioni, provider LayerResult e classKey, catalogo, adapter del paese, fixture, test offline/live, limiti e metodo. Per un paese: nuovo CountryAdapter in `countries/<code>`, registry/fonti e ampliamento additivo CountryCode/query. Il core resta agnostico. PostGIS può sostituire ricerca/geometria dietro l’adapter; Redis Cache/HostLimiter. Redis Cache da solo non rende globale la deduplicazione.

OMI può pubblicare quotazioni residenziali senza dichiarare una tipologia prevalente: in quel caso il livello è `partial` e mostra tutte le tipologie disponibili, senza attribuire una prevalenza. Se non pubblica prezzi residenziali, lo stato è `empty`, mantenendo la zona e il semestre. La fixture reale rurale registra questo caso.

## Espansione terreni, sessione C

`countries/it/layers/osm-land.ts` contiene query condivisa, parsing validato e tre provider: rete elettrica, distanze infrastrutturali, aree industriali/cave/discariche. Bbox conservative estese all'ingombro del lotto, geometrie complete di nodi/way, filtro geodetico finale entro 10 km/2 km. Terreni con ingombro oltre 2 km dal punto rappresentativo non interrogati. La distanza minima è fra geometria OSM e lotto, zero se intersecano; su un punto è la distanza alla geometria. Relazioni OSM escluse e nessun bbox-center spacciato per geometria. Le tensioni non interpretabili restano sconosciute.

`regional-land-cover.ts` adatta WMS text/plain Toscana e ArcGIS REST Lombardia: verifica formato, layer, attributi e troncamenti, restituisce classe sul punto. Identificazione non riuscita non diventa assenza. Le classi reali UCS e DUSAF hanno provenienza distinta e non si trasformano in percentuali impermeabilizzate o zone legali.

`geo/terrain.ts` espone il gradiente del piano medio, riusato per pendenza e orientamento. Nessuna chiamata DEM aggiuntiva per aspect. Aspetti quasi piani (<0,5%) o non stimabili restano null; la quota areale a sud resta null.

L'HTTP client conta i chiamanti di una richiesta deduplicata: abort di uno non ferma gli altri, abort dell'ultimo annulla upstream/coda e rilascia lo slot. Cancellazioni dei chiamanti non generano cache negative. Le cache negative di errori di protocollo preservano il tipo, affinché il retry catastale funzioni anche con un'eccezione già in cache. Timeout e Retry-After restano nel budget totale della request. Il limite layer 25 s isola ciascun provider, anche se ignora il signal.

Ricerca e motivi di esclusione: `docs/research/land-data-2.md`. Misure riproducibili con `scripts/land-live.ts` in processi separati, fredde poi calde; `npm run test:live` esegue anche questi controlli. Cache, limiter e dedupe sono locali al processo, non globali fra istanze serverless.
