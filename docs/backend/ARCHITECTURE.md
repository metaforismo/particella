# Backend Particella

TypeScript nel runtime Node.js di Next.js 16.3.8, App Router. Un solo processo applicativo per sviluppo; nessun Python, database, servizio Edge o import massivo. La ricerca di partenza è in `docs/research/`; solo il manifest delle evidenze è copiato nel worktree.

## Moduli e richiesta

- `src/lib/contracts/index.ts`: schemi zod v4 condivisi con il frontend. La sola aggiunta backend è `Health`; URL http/https e template degli overlay locali sono rispettati.
- `src/server/core/`: HTTP, cache, errori, provenienza, definizione delle fonti, risultati e isolamento dei layer. Non interpreta codici catastali o dataset italiani.
- `src/server/geo/`: assi GML, geometrie Polygon/MultiPolygon, copertura del punto, area/perimetro geodetici, distanze, campioni del terreno e bbox Mercator.
- `src/server/countries/`: registry degli adapter e composizione delle fonti; `it/` possiede le fonti, i protocolli, il catasto e gli otto provider italiani.
- `src/server/http/`: query rigorose, validazione delle risposte, cache HTTP ed envelope degli errori.
- `src/app/api/v1/`: route Node.js. I parametri dinamici sono Promise, tipizzati con `RouteContext` generato da Next. Nessuna importazione da componenti o pagine frontend.

Una query viene validata, risolta dall'adapter del paese, normalizzata dal provider e validata di nuovo al confine HTTP. In sviluppo/test si usa `.parse`; in produzione `.safeParse`. Un payload di risposta invalido produce log senza contenuto della query e HTTP 500 `internal`, mai un successo con JSON invalido. Anche gli errori sono validati. I tile binari hanno uno schema locale per firma PNG e dimensioni 256×256.

`plotAt` verifica il comune ISTAT, legge i candidati WFS AdE nella bbox, analizza il GML e sceglie esclusivamente la geometria che copre il punto. I bordi sono inclusi; più candidati coprenti sono un errore di selezione. Strade e acque producono 404. Foglio e sezione derivano dalla mappa catastale e dal suo `LABEL`, senza rimuovere zeri a intuito. L'ID ha forma `it:Belfiore:sezione_o_:foglio:particella`.

`plotById` usa la cache se presente; a cache vuota interroga la mappa tramite comune/foglio e poi il riferimento esatto della particella. L'esito del recupero a cache vuota è verificato separatamente in `tests/live-results.json`: la prova offline di roundtrip non certifica che il provider remoto supporti i filtri attributo.

Il report lancia gli otto layer in parallelo. Il recupero iniziale del lotto ha un limite di 25 secondi. Ogni layer ha un limite di 25 secondi, un AbortSignal e una Promise di scadenza che risolve anche se il provider ignora il segnale. Un errore diventa `unavailable` nel suo solo layer. Risultati parziali non ricevono cache HTTP pubblica.

## Cache, rete e quote

`Cache` espone `get<T>` e `set<T>` asincroni. `MemoryCache` conserva copie, elimina le voci scadute, applica LRU e limita sia il numero di voci (512) sia il peso serializzato (32 MiB, oltre all'overhead degli oggetti JavaScript). Non crea file su disco. Una risposta HTTP non può superare 12 MB.

| Oggetto                                      | TTL        |
| -------------------------------------------- | ---------- |
| Risposta remota, particella, risultato layer | 24 ore     |
| Geocoding                                    | 30 giorni  |
| PVGIS                                        | 90 giorni  |
| Tile WMS                                     | 7 giorni   |
| Errore / risultato parziale                  | 30 secondi |

Le chiavi ordinano parametri e oggetti; le richieste HTTP includono metodo, body e header. I layer includono ID, hash geometria, punto e comune. Si deduplicano sia HTTP sia analisi in corso. `retrievedAt` rimane quello della risposta originale anche dopo un hit in cache; `computedAt` è la data del risultato conservato. La data del dataset è distinta e rimane null se ignota. Una modifica di metodo va accompagnata da una revisione del namespace `v1` della cache pertinente.

HTTP usa timeout complessivo, User-Agent `Particella/0.1 (+https://github.com/metaforismo/particella)`, limite di concorrenza e distanza tra avvii per host. Retry solo per errori di connessione e HTTP 408/429/500/502/503/504, con backoff e jitter. `Retry-After` differisce anche le nuove richieste dello stesso host; se supera il tempo residuo, 429 viene restituito senza anticipare il retry. HTML, eccezioni OGC dentro HTTP 200, errori ArcGIS/Overpass e risposte troncate non diventano dati vuoti. Non si seguono redirect verso host arbitrari.

Nominatim: 1 richiesta/s e una sola in corso; richiesta esplicita dell'utente, niente autocomplete. Il limite è per tutta l'app, non per utente ([policy OSMF](https://operations.osmfoundation.org/policies/nominatim/)). In produzione l'istanza pubblica richiede `PARTICELLA_SINGLE_INSTANCE=1`, da impostare solo per un singolo processo; su Vercel usare un geocoder proprio o un proxy con quota globale. OpenTopoData: 1/s e 1000/giorno per processo ([limiti del provider](https://www.opentopodata.org/)). Queste quote non sono globali su più istanze: prima di scalare servono limiter condiviso/Redis oppure hosting dedicato. Anche Overpass pubblico è disabilitato in produzione: configurare hosting proprio o concordato.

Le fonti sono anonime; `.env.example` documenta tutti gli override. Le URL pubbliche di attribuzione sono separate dagli endpoint configurati; `requestUrl` elimina credenziali, token, chiavi e firme. Il catalogo pubblico non espone gli endpoint privati configurati.

## Geometria e significato

GeoJSON è sempre lon/lat. GML AdE EPSG:6706 usa lat/lon; proj4 normalizza gli assi e applica l'approssimazione di datum nulla verso WGS84, dichiarata nella provenienza. Non c'è trasformazione di epoca o griglia sub-metrica. Area e perimetro Turf sono geometrici, non superficie censuaria.

| Layer           | Metodo e scala                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| flood           | WMS IdroGEO P1/P2/P3 sul punto rappresentativo; scope `point`                                                    |
| landslide       | PAI P1–P4/AA e IFFI distinti, screening WMS puntuale; codici numerici PAI verificati nel GetStyles ufficiale     |
| seismic         | DPC maggio 2025 per comune, PGA MPS04 del nodo geodeticamente più vicino nella bbox ±0,15°, non interpolata      |
| protected-areas | Natura 2000 / NatDA EEA: contiene, interseca o vicino entro 1000 m; distanza approssimata tra vertici e segmenti |
| terrain         | TINITALY 10 m, fallback EU-DEM 25 m; massimo 17 campioni coperti dal poligono; pendenza da piano stimato         |
| solar           | PVGIS 5.3: 1 kWp, cristallino, perdite 14%, montaggio libero, inclinazione/azimut ottimali e orizzonte DEM       |
| services        | OSM via Overpass, categorie entro 500 m / 1 km; distanze in linea d'aria, centro bbox per way/relation           |
| demographics    | ISTAT 2021 cella 1 km² del punto, più stima comunale 2026 se presente nello snapshot                             |

`empty` è una query riuscita senza oggetti; `outside_coverage` è una copertura mancante nota; `unavailable` è un errore della fonte. Nessuno dei tre significa assenza di rischi o autorizzazione a costruire. I dati di scala comune/cella/buffer non sono presentati come valori del lotto. La quota puntuale senza poligono resta `partial` perché la pendenza non è calcolabile.

Il proxy consente solo `cadastre`, `flood`, `landslide`, con attribuzioni delle rispettive licenze. Calcola la bbox EPSG:3857. AdE non supporta quel CRS: richiede EPSG:6706 con assi lat/lon e ricampiona le righe del PNG in Mercator. Sotto zoom 12 il catasto restituisce un tile trasparente. Non accetta URL o layer WMS arbitrari.

## Snapshot e refresh

JSON compatti e versionati in `data/snapshots/`: DPC nazionale e popolazione dei soli comuni Milano/Firenze. Ogni release conserva URL, data di acquisizione e hash SHA-256. Non vengono scaricati archivi nazionali o raster grandi.

```bash
DPC_VERSION=2026-05 DPC_CSV_FILE=/percorso/release.csv npm run snapshots:refresh
```

Usare la versione effettivamente pubblicata; l'esempio non afferma che esista una release maggio 2026. Lo script crea un file nuovo con `wx`; non sovrascrive snapshot. Per aggiornare il provider modificare import e metadati della release e rieseguire i test. `POPULATION_REFRESH=1` aggiunge il download dei soli due ZIP provinciali; impostare un nome di snapshot nuovo. Eseguire il refresh solo dopo verifica della fonte e con spazio disponibile.

## Estensione

Per un layer aggiungere un provider nell'adapter del paese, usare `layerResult`, metriche con unità, feature con `classKey`, note e provenienza per ogni fonte riuscita. Registrare la fonte con licenza, URL, protocollo, copertura, policy host e stato di verifica. Aggiungere il layer al catalogo e una fixture reale ridotta con manifest; verificare anche vuoto, errore e scala. Se il LayerId è nuovo, aggiornare prima il contratto condiviso in modo additivo.

Per un paese aggiungere `countries/<code>/` e il relativo `CountryAdapter`, registrarlo in `countries/index.ts` e comporre le fonti in `countries/sources.ts`. Ampliare additivamente `CountryCode` e la selezione nelle query HTTP. Il core non deve contenere interpretazioni dei nuovi identificativi nazionali.

PostGIS può sostituire la ricerca/geometria dietro lo stesso adapter; Redis può implementare `Cache` e `HostLimiter`. Con cache distribuita anche la deduplicazione va resa globale o tramite lock: cambiare solo `Cache` non coordina le richieste in volo.

## Verifica e limiti di rilascio

`npm test` usa node:test e fixture locali: nessuna rete. Copre parser, geometria, servizi, tutti gli otto provider, errori/quote/timeout, contratto e route. `npm run test:live` è manuale, fuori dalla CI: Duomo Milano e Bagno a Ripoli rurale, lookup freddo, layer e tre tile. Salva l'esito reale in `tests/live-results.json` ed esce con 1 se un controllo fallisce; `partial` viene contato a parte.

Prima di un rilascio verificare l'ultimo esito live, la risoluzione catastale a cache vuota e l'hosting/quote globali. Non sono implementati Redis/PostGIS, urbanistica/NTA, paesaggio, uso del suolo, accessibilità o mercato. Il backend produce screening con fonti; non certifica edificabilità o vigenza degli atti locali.

Il WFS AdE ha confermato il foglio 60 da bbox, ma il filtro attributo sullo stesso foglio ha restituito `numberMatched="unknown"`, `numberReturned="0"`. La fixture `ade-zoning-filter-empty.xml` registra il limite. Il backend restituisce 502 per questo caso, evitando un falso 404. La risoluzione a cache vuota su nuove istanze rimane un requisito non soddisfatto della fase: serve un lookup ufficiale verificato o un indice catastale condiviso. Le risposte raw delle ricerche da ID sono conservate soltanto 30 secondi.
