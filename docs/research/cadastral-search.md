# Ricerca catastale — sessione E, 6 ottobre 2026

## Scelta verificata

**Download ufficiale AdE → indice comunale di fogli/etichette/bbox → conferma della geometria WFS per bbox.** Nessun riferimento di foglio viene dedotto dagli zeri di un identificativo. Il punto restituito è strettamente interno al poligono confermato live, calcolato con intervalli di una scanline; non è il centro della bbox né un vertice.

Il [metadato nazionale RNDT](https://geodati.gov.it/geoportale/visualizzazione-metadati/scheda-metadati?metadataid=age%3Afornitura_dati_catasto) e il record CSW `age:S_0000_ITALIA` dichiarano CC BY 4.0, aggiornamento semestrale e struttura regione → provincia → Comune. Le richieste complete, tempi/status e risposte abbreviate dei tentativi sono nei JSON `cadastral-*-probes.json`; i risultati positivi della ricerca sono in [cadastral-live-searches.json](cadastral-live-searches.json). Sono osservazioni da questa macchina, non SLA.

## a. Filtri WFS: nessuna sintassi verificata per gli attributi

Endpoint: `https://wfs.cartografia.agenziaentrate.gov.it/inspire/wfs/owfs01.php`. Controllo positivo per bbox del foglio 21C di Firenze: HTTP 200, geometria e riferimento `D612_0021C0` confermati.

| Tentativo                                                                                                | Risposta reale                                                                                  | Decisione                                   |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------- |
| FES 2.0 `PropertyIsEqualTo` / `ValueReference`, proprietà con/senza `CP:`                                | HTTP 200, circa 807 byte, `numberMatched="unknown"`, nessun membro                              | Nessuna prova di assenza; non usare per 404 |
| Foglio: `ADMINISTRATIVEUNIT=D612`, `LABEL=21C`, riferimento nazionale esatto                             | Stesso vuoto non confermato                                                                     | Nessun foglio ottenuto per attributo        |
| Particella: riferimento nazionale esatto                                                                 | Stesso vuoto non confermato                                                                     | Nessuna geometria confermata                |
| OGC Filter WFS 1.0/1.1, `TYPENAME`, `FILTER` e `filter`; FES 2.0 con `TYPENAME`                          | Vuoti non confermati, 747–807 byte                                                              | Nessuna alternativa funzionante             |
| `CQL_FILTER`                                                                                             | Ignorato: foglio `A001_000100`, particella `A001_000100.ACQUA001`, mentre si richiedeva Firenze | Scartato dopo confronto degli attributi     |
| `RESOURCEID`, incluso ID `CadastralParcel.IT.AGE.PLA.A564_006000.109` osservato nel GML                  | Eccezione OGC `InvalidFormat`, HTTP 200                                                         | Non disponibile                             |
| `STOREDQUERY_ID=urn:ogc:def:query:OGC-WFS::GetFeatureById`, `ListStoredQueries`, `DescribeStoredQueries` | Eccezione OGC `InvalidFormat`, HTTP 200                                                         | Non disponibile                             |

I tentativi durano tipicamente meno di un secondo; i tempi esatti di ciascuno sono nei JSON. Il precedente limite del WFS è riprodotto. Non si promuove HTTP 200 a ricerca riuscita.

## b. Foglio per attributo, poi bbox e filtro locale

Il prerequisito non è verificato: non è stato ottenuto un foglio AdE per attributo. **Questa catena non può essere usata autonomamente.** Il download completo comunale fornisce invece i riferimenti esatti delle mappe, le loro `LABEL` e le bbox delle particelle; la ricerca usa direttamente la bbox della particella richiesta, più selettiva di quella del foglio. Risposta live senza esattamente un membro corrispondente al riferimento richiesto, troncata o con eccezione → 502, mai particella vicina o falso 404.

## c. Download: misure e indicizzazione

`GetDataset.php?dataset=TOSCANA.zip` reindirizza al CDN ufficiale `wfs-download.cartografia.agenziaentrate.eu`. GET con `Range` restituisce HTTP 206 e `Content-Range`. HEAD e richieste senza dataset sono state rifiutate; la misura del file deriva dalla risposta GET parziale, non da HEAD.

Toscana: **1.192.746.140 byte**. Indice ZIP regionale finale: circa 65 KiB letti. Al suo interno FI.zip: 193.493.191 byte; SI.zip: 132.263.155 byte. Download iniziale dei segmenti provinciali completi: 146,81 s e 78,18 s, subito eliminati dopo estrazione delle misure. I nomi comunali reali sono `A564_BAGNO A RIPOLI.zip`, `I726_SIENA.zip`, `D612_FIRENZE.zip`. Chiederli direttamente a GetDataset.php restituisce HTTP 500; `D612.zip` restituisce un'eccezione. I percorsi diretti comunali/provinciali provati sul CDN sono 404. Il servizio verificato espone il contenitore regionale.

| Comune         | ZIP comunale reale, byte | GML particelle espanso, byte | Particelle / fogli | Indice JSON, byte | Costruzione indice locale |
| -------------- | -----------------------: | ---------------------------: | -----------------: | ----------------: | ------------------------: |
| Bagno a Ripoli |                4.780.905 |                   41.316.079 |        27.549 / 76 |         1.672.260 |                    1,56 s |
| Siena          |                7.740.804 |                   58.262.286 |       36.770 / 145 |         2.239.335 |                    0,48 s |
| Firenze        |               17.118.912 |                  161.022.081 |      110.804 / 297 |         6.782.383 |                    2,73 s |

I tempi locali comprendono parsing e costruzione; dipendono dal carico e dalla cache della macchina.

L'implementazione migliora la misura iniziale: legge la directory ZIP regionale, avvia l'intervallo della provincia e **interrompe la decompressione appena trova il Comune**, saltando i precedenti membri senza conservarli.

| Comune         | Byte trasferiti effettivi, inclusi indice/header e read-ahead | Download parziale del Comune |
| -------------- | ------------------------------------------------------------: | ---------------------------: |
| Bagno a Ripoli |                                                     4.921.576 |                       3,25 s |
| Firenze        |                                                    66.406.888 |                      43,03 s |
| Siena          |                                                   114.313.416 |                      68,11 s |

Misure riproducibili in [cadastral-stream-measurements.json](cadastral-stream-measurements.json), hash degli archivi e conteggi negli output di preparazione documentati sotto. **Indicizzare su richiesta è realistico, ma la prima richiesta può durare oltre un minuto**; la posizione del Comune nel ZIP provinciale influisce più del suo ZIP finale. Con indice caldo, le sei ricerche iniziali hanno richiesto circa 1–3 secondi ciascuna, con WFS/ISTAT live. Le route interessate consentono 300 s, download massimo 180 s. L'hosting deve supportare questa durata oppure pre-riscaldare gli indici.

Cache: `PARTICELLA_CADASTRAL_INDEX_DIR`, default directory `particella-cadastral-index-v1` nel temporaneo di sistema. File JSON per Belfiore, scrittura atomica, TTL 7 giorni, budget 256 MiB, massimo 16 MiB per indice. I GML vengono letti in streaming, controllando completezza, conteggi e CRC; vengono conservati solo riferimenti, fogli, sezioni e bbox. Nessun archivio resta su disco durante il percorso automatico. Limiti: 256 MiB trasferiti, 512 MiB provincia espansa, 64 MiB ZIP comunale, 4 MiB per elemento GML. ZIP64/data descriptor non supportati: errore esplicito. Un indice assente/scaduto/non valido viene ricostruito; le richieste contemporanee nello stesso processo condividono la costruzione. Cache oggetti non implementata; un volume persistente conserva gli indici fra riavvii. Fra istanze serverless la cache temporanea non è condivisa.

Preparazione manuale, senza archivi permanenti:

```bash
node --experimental-strip-types scripts/cadastre-index.ts "Firenze"
# Oppure un ZIP comunale ufficiale già estratto, con codice verificato:
node --experimental-strip-types scripts/cadastre-index.ts "Firenze" /tmp/D612_FIRENZE.zip
```

## d. Altri servizi ufficiali

[Regione Toscana, WMS Catasto](https://www502.regione.toscana.it/geoscopio/servizi/wms/CATASTO.htm): lo stesso endpoint `ows_catasto/.../ows?map=owscatasto` espone WFS 1.1, layer di ricerca `rt_cat.idcatbdpart.bbox.rt.wfs_search`, proprietà `comune`, `foglio`, `particella`, `zona_cens`. Capabilities e DescribeFeatureType sono stati letti live. Un GetFeature senza filtro restituisce un record reale, ma la geometria della bbox nel membro è degenerata e fuori Italia mentre l'envelope della collezione è in Toscana. Filtro GET per Firenze/150B/782 → HTTP 403; POST WFS standard → collezione vuota senza conteggio di completezza. CQL GET → HTTP 403. [La pagina ufficiale dei servizi di ricerca](https://www502.regione.toscana.it/geoscopio/servizi/wfs/servizi_ricerca.html) riporta «momentaneamente non disponibile». Non è un fallback verificato.

AdE WMS GetFeatureInfo sul punto rurale con layer `CP.CadastralParcel` e `text/xml`: eccezione `InvalidFormat`. Il WMS già usato per i tile resta una visualizzazione; non localizza autonomamente una query comune/foglio/particella. Non è stata qualificata una rete completa di servizi regionali: questa indagine copre il servizio regionale direttamente pertinente agli esempi e le strade nazionali ufficiali; nessuna pretesa di aver censito ogni servizio locale d'Italia.

## Risoluzione Comune e limiti di verità

Lo snapshot è scaricato live dal CSV ufficiale [ISTAT](https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.csv), con URL, retrieval time e SHA-256 in `data/snapshots/it-municipalities.json`. Contiene 7.896 righe. La [pagina corrente ISTAT](https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/) ne dichiara 7.894 e rinvia a SITUAS: **il CSV legacy è più vecchio dell'anagrafe corrente; non viene chiamato aggiornato al 2026**. Nomi esatti, varianti linguistiche presenti nel CSV, accenti/apostrofi normalizzati, provincia facoltativa `Nome (XX)` o `Nome XX`. Il Comune catastale può differire da quello amministrativo: il caso reale Alassio foglio 1 particella 1, A122, ricade nei confini ISTAT di Villanova d'Albenga. La ricerca conserva il codice catastale confermato e dichiara il Comune amministrativo nella descrizione; `Plot.municipality` usa il Comune del punto e il suo codice Belfiore da snapshot, mentre `Plot.cadastral.municipalityCode` resta quello della particella. Entrambe le fonti sono conservate. Gli omonimi restituiscono 400 con opzioni e codici; nessuna scelta automatica della prima occorrenza. Aggiornamento riproducibile: `node --experimental-strip-types scripts/snapshots/municipalities.ts`.

La mancanza di foglio/particella è un **404 nel download semestrale dichiarato nel messaggio**, non una certificazione di inesistenza nell'archivio censuario attuale. Il timestamp GML è la generazione del download, non la data di efficacia del singolo confine. Una discrepanza con il WFS live è 502. Trento/Bolzano esclusi; nuove province o codici assenti dall'archivio producono un errore esplicito. La trasformazione WGS84/ETRF2000 mantiene l'approssimazione già dichiarata dal progetto.

## Parser e prove

Forme supportate: `Firenze, foglio 150B, particella 782`, `F. 12 p. 340 Bergamo`, `fg 12 mapp 340 comune di Bergamo`, sezione esplicita con `sezione`/`sez.`. Ordine invertito e zeri iniziali numerici supportati; sezione numerica conserva gli zeri. Query incomplete/duplicate e subalterni non gestiti → 400, senza invio al geocoder testuale.

Query positive verificate: Agliè foglio 51 particella 1 (Piemonte); Alassio foglio 1 particella 1 (Liguria); Acquasparta foglio 1 particella 1 (Umbria); Agrigento foglio 191 particella 1 (Sicilia); Abano Terme foglio 22 particella 1 (Veneto); Firenze foglio 150B particella 782 (Toscana). Fixture XML/JSON originali, URL e hash nel manifest; geometrie inalterate. Lo ZIP piccolo dei test contiene due risposte WFS reali complete nella loro finestra, confezionate per provare il lettore ZIP: **non è un download comunale completo**.

## Lotti: confronto e contratto scelto

Alternativa A: lotto persistente con ID opaco, POST e archivio centrale; richiede storage condiviso e gestione del ciclo di vita. Alternativa B, scelta: ID canonico `id1+id2`, POST senza persistenza obbligatoria, `parcels[].at` per ricostruzione spaziale su un'altra istanza. Più semplice per il frontend e gli URL. L'ordine canonico è lessicografico per ID; le coordinate devono seguire quello stesso ordine.

Massimo 20 particelle singole distinte dello stesso Belfiore, senza aggregati annidati. I Comuni ISTAT conosciuti devono concordare. L'unione Turf elimina i confini interni; restituisce sempre MultiPolygon, area geodetica e perimetro dell'unione, provenienza calcolata non ufficiale. Parti disgiunte sono ammesse; il punto interno appartiene a una parte, non rappresenta ciascuna parte. Tutti i provider ricevono geometria unita e quel punto. Le note dichiarano gli ambiti puntuali/zone/buffer/celle; i valori comunali restano comunali. Le normali limitazioni dei layer, comprese copertura e limite geografico Overpass, restano visibili. API e helper frontend in [API.md](../backend/API.md).
