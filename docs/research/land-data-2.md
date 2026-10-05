# Terreni: verifica delle fonti, sessione C

Data: **6 ottobre 2026, Europe/Rome** (i timestamp delle chiamate sono UTC). Priorità: scouting fotovoltaico/agrivoltaico, poi attività dei tecnici. Ricerca e chiamate effettive; nessuna classificazione automatica di edificabilità o idoneità FER.

## Evidenza e criterio di ammissione

Manifest versionato: `docs/research/evidence/land-data-2/manifest.json`, con endpoint, richiesta esatta, codice HTTP, timestamp, CORS e hash delle risposte quando disponibili. Risposte grezze locali ignorate da Git; fixture reali ridotte con URL/hash/metodo di riduzione in `tests/fixtures/manifest.json`. Una risposta HTTP 200 contenente ExceptionReport, HTML o remark di timeout **non è** una verifica riuscita. I punti sotto sono interrogazioni geografiche, non certificazioni di uso del singolo bene.

| Punto | Tipo verificato nella ricerca | Regione | Coordinate lat,lon |
|---|---|---|---|
| Firenze centro | urbano | Toscana | 43.769270,11.256500 |
| Bagno a Ripoli | agricolo (UCS: seminativi) | Toscana | 43.700000,11.320000 |
| Vallombrosa | collinare/montano | Toscana | 43.733000,11.556000 |
| Milano centro | urbano | Lombardia | 45.464800,9.191000 |
| Lodigiano, territorio di Borgo San Giovanni | agricolo (DUSAF: risaie) | Lombardia | 45.307000,9.329000 |
| Valsassina | montano (DUSAF: bosco ceduo) | Lombardia | 45.929000,9.445000 |

UCS e DUSAF: tre chiamate per regione; risposte complete in tutte e sei le interrogazioni, comprese le risposte vuote. OSM: risposte complete con geometrie su Milano, Bagno a Ripoli, Vallombrosa e Valsassina; documentati anche tentativi falliti. L'endpoint `overpass.kumi.systems` è andato in timeout su tre punti: **non configurato né aggiunto come fallback**. I provider nuovi usano solo `OVERPASS_URL` (default `overpass-api.de`), con una sola query condivisa e senza fallback implicito.

## Decisioni per fonte

| Fonte / oggetto | Implementata | Motivo / limite |
|---|---|---|
| MASE/GSE PAI, idoneità FER | No | PAI esiste ma accesso riservato agli enti; non verificata API pubblica con licenza e vigenza normative complete |
| Terna, geometrie AT/AAT | No | Portale dati/API e mappe pubblici; non verificato un endpoint vettoriale aperto interrogabile per tracciati e stazioni |
| GSE, mappa cabine primarie CER | No | Aree convenzionali di competenza, non ubicazioni fisiche delle cabine né disponibilità di connessione |
| OSM/Overpass, rete elettrica | Sì: `power-grid` | Geometrie vere, tensioni esplicite ≥132000 V, distanza dal confine; stazioni censite separate da stazioni con tensione ≥132 kV |
| Catasto incendi Toscana | No | Servizio individuato; non completate licenza specifica e verifica in una seconda regione |
| EFFIS aree bruciate | No | Identify text/plain risponde ma archive annuale ha estensione anomala nelle capabilities; nessuna intersezione positiva confermata, neppure nel controllo di Calci 2018 |
| Vincolo idrogeologico Toscana/Piemonte | No | Identify reale; manca conferma della licenza specifica del layer toscano. I soli vuoti piemontesi non validano un vincolo nazionale |
| LCC Toscana / ESDAC | No | Toscana interrogata in tre punti ma non seconda regione; licenza specifica da confermare. ESDAC/LUCAS non equivale alla LCC particellare e alcuni dataset richiedono domanda/licenza dedicata |
| UCS Toscana 2019 / DUSAF Lombardia 2021 | Sì: `regional-land-cover` | Identify e licenze verificate, classi sul punto; nessuna percentuale areale derivata |
| Consumo di suolo ISPRA 10 m | No | Catalogo interrogato: statistiche territoriali pubbliche e un servizio suolo con errore JSON 499 Token Required; non verificato raster pubblico adatto a una percentuale sul lotto |
| SISBON / PSC-AGISCO | No | Fonti amministrative esistono; non verificata query geospaziale pubblica con licenza e tre punti / due regioni |
| Cave/discariche/aree industriali OSM | Sì: `industrial-sites` | Censimento collaborativo di geometrie entro 2 km; nessuna inferenza di bonifica, dismissione o idoneità |
| Strade/ferrovie/cimiteri/pozzi OSM | Sì: `infrastructure-distances` | Distanze geometriche, mai fasce legali; pozzi non necessariamente potabili |
| TINITALY / EU-DEM | Estensione di `terrain` | Aspect medio stimato dal medesimo piano e dai campioni reali; quota areale a sud `null`, non stimata arbitrariamente |
| Infratel/BUL | No | Endpoint legacy open data non raggiungibile nel test; non verificata disponibilità al civico/lotto né licenza aggiornata |

## 1. Aree idonee e criteri oggettivi

La [L. 4/2026](https://www.gazzettaufficiale.it/eli/id/2026/01/20/26G00016/sg) converte il DL 175/2025. Il riferimento storico art.20 D.Lgs.199/2021 non basta per un motore giuridico aggiornato: verificare disciplina successiva nel D.Lgs.190/2024, modifiche e leggi regionali vigenti. Non viene codificata una distanza legale uniforme.

Il [GSE descrive i layer PAI](https://assistenza.clienti.gse.it/csm/it/informazioni-visualizzabili-nelle-mappe-della-pai?id=faq&sys_id=55444d923be2569473dc9ac5e4e45af8) e [l'accesso riservato](https://assistenza.clienti.gse.it/csm/it?id=faq&sys_id=765405163be2569473dc9ac5e4e45ad0). Protocollo/API pubblica, layer tecnici, licenza di riuso commerciale, CORS e aggiornamento: **non verificati**. Quindi nessun curl di query pubblica funzionante e nessun provider PAI. Questo non significa che le mappe non esistano.

Toscana pubblica un WMS storico `https://www502.regione.toscana.it/wmsraster/com.rt.wms.RTmap/wms?map=wmsrinnovabili` ([scheda](https://www502.regione.toscana.it/geoscopio/servizi/wms/FONTI_RINNOVABILI.htm)); non verificata coerenza con le leggi 2026 o diritto di riuso specifico. Non collegato. Un layer storico «non idoneo» non dimostra l'idoneità attuale per un impianto specifico.

**Calcolabile, con scope limitato:** distanze da autostrade e ferrovie; vicinanza a aree industriali, cave e discariche censite; classe agricola/urbana sulla carta regionale; vincoli già disponibili con il loro scope. **Non deducibile automaticamente:** natura giuridica del sito, dismissione/bonifica, impianti autorizzati, diritti di accesso, aree di tutela non pubblicate, deroghe, prescrizioni comunali, disponibilità all'allaccio. L'assenza di elementi restituiti non costituisce idoneità.

## 2. Rete elettrica

Terna: [rete nazionale](https://www.terna.it/it/chi-siamo/attivita/rete-elettrica-italiana), [portale dati](https://dati.terna.it/), [catalogo API](https://developer.terna.it/docs/read/apis_catalog/generation), [VAS](https://portalevas.terna.it/). Dati statistici, documenti e visualizzazione non dimostrano un servizio geometrico aperto per distanza da linee/stazioni. Endpoint vettoriale, layer esatti, riuso commerciale delle geometrie, aggiornamento e CORS: non verificati, nessun provider Terna.

[GSE cabine primarie](https://www.gse.it/servizi-per-te/autoconsumo/mappa-interattiva-delle-cabine-primarie): la mappa serve a localizzare aree convenzionali per configurazioni di autoconsumo. Non sostituisce la posizione fisica di una cabina, né fornisce capacità di connessione; non usata per calcolare distanze.

OSM: REST Overpass `https://overpass-api.de/api/interpreter`, query `way[power=line]`, `nw[power=substation]`, attributi `voltage`, `substation`, geometrie `out geom tags`. Copertura globale, completa solo quanto il censimento; aggiornamento timestamp `osm3s.timestamp_osm_base`, non data del rilievo. CORS `*` osservato. [ODbL 1.0](https://www.openstreetmap.org/copyright): commerciale sì con attribuzione e obblighi ODbL; **licenza dati e condizioni del server sono distinte**. Hosting pubblico non qualificato per scouting intensivo: produzione disabilitata senza `OVERPASS_URL` dedicato. Limiter 1 richiesta in volo / avvio ogni 5 secondi, in memoria per processo.

Curl realmente verificato, stessa forma della ricerca (Milano; la query implementata estende la bbox per includere tutto il lotto):

```sh
curl -sS --fail-with-body --max-time 25 -A 'Particella/0.1 (+https://github.com/metaforismo/particella)' -G 'https://overpass-api.de/api/interpreter' \
  --data-urlencode 'data=[out:json][timeout:15];(way(45.374710,9.062547,45.554890,9.319453)[power=line];nw(45.374710,9.062547,45.554890,9.319453)[power=substation];way(45.446782,9.165309,45.482818,9.216691)[highway~"^(motorway|trunk|primary|secondary)$"];way(45.446782,9.165309,45.482818,9.216691)[railway=rail];nw(45.446782,9.165309,45.482818,9.216691)[landuse~"^(cemetery|industrial|quarry|landfill)$"];nw(45.446782,9.165309,45.482818,9.216691)[amenity=grave_yard];node(45.446782,9.165309,45.482818,9.216691)[man_made=water_well];);out geom tags;'
```

Le coordinate esatte delle chiamate effettive sono nel manifest. Gli esempi possono fallire in altri momenti: 504 e remark timeout osservati. Nella ripetizione curl, senza User-Agent esplicito il server ha restituito HTML 406; con il medesimo User-Agent identificativo del provider, HTTP 200 e geometrie complete. Viene verificato il corpo JSON, non solo HTTP 200. Tensioni senza unità interpretabile non diventano 132 kV per convenzione; valori in volt e liste `132000;220000`. Niente informazioni sulla potenza disponibile. Linee senza `voltage` non sono considerate AT certa e causano `partial`.

## 3. Incendi

Catasto regionale Toscana: [scheda](https://www502.regione.toscana.it/geoscopio/servizi/wms/INCENDI.htm), endpoint `https://www502.regione.toscana.it/ows_catasto/com.rt.wms.RTmap/ows?map=owsincendi&language=ita`. Strati suddivisi per province/anni. Protocollo WMS; layer puntuale operativo, licenza specifica, aggiornamento e prove in seconda regione non completati. CORS `*` sulla scheda, non attestato sull'identify. Non implementato.

EFFIS: endpoint aggiornato `https://maps.effis.emergency.copernicus.eu/effis`, WMS 1.1.1, layer `modis.ba.poly.2016` … `modis.ba.poly.2025`, `modis.ba.poly.season`; `GetFeatureInfo` accetta `text/plain` e GML, **non** `application/json` (HTTP 200 ServiceException). [Licenza](https://forest-fire.emergency.copernicus.eu/about-effis/data-license): contenuti UE CC BY 4.0 salvo diritti di terzi, commerciale sì per tali contenuti. Copertura dichiarata EFFIS europea/mediterranea, osservazioni satellitari, aggiornamento stagionale/annuale. CORS `*`.

Identify singolo e combinazione 2016–2025: vuoti su tutti i punti e anche sul controllo Calci 43.760,10.533 (controllo supplementare sullo strato 2018). Le capabilities del layer 2025 riportano bbox `-29.088598,12.992021,-29.085072,12.995128`, fuori dall'Italia. Non è una prova sufficiente di copertura o assenza di incendi: **non implementato**, da verificare su servizio archivio funzionante con positivo confermato.

```sh
curl -sS --fail-with-body --max-time 20 -G 'https://maps.effis.emergency.copernicus.eu/effis' \
  --data-urlencode 'service=WMS' --data-urlencode 'version=1.1.1' \
  --data-urlencode 'request=GetFeatureInfo' --data-urlencode 'layers=modis.ba.poly.2025' \
  --data-urlencode 'query_layers=modis.ba.poly.2025' --data-urlencode 'info_format=text/plain' \
  --data-urlencode 'srs=EPSG:4326' --data-urlencode 'bbox=11.25649,43.76926,11.25651,43.76928' \
  --data-urlencode 'width=101' --data-urlencode 'height=101' --data-urlencode 'x=50' \
  --data-urlencode 'y=50' --data-urlencode 'feature_count=100' --data-urlencode 'format=image/png' --data-urlencode 'styles='
```

Questo curl dimostra una risposta vuota, **non** una copertura affidabile. Non serve a determinare le restrizioni dell'art.10 L.353/2000: termini e condizioni per destinazione d'uso ed edificazione sono distinti e dipendono da bosco/pascolo, catasto, atti e deroghe. Non calcolare scadenze giuridiche dall'anno satellitare.

## 4. Vincolo idrogeologico

Toscana: [scheda](https://www502.regione.toscana.it/geoscopio/servizi/wms/VINCOLO_IDROGEOLOGICO.htm), WMS `https://www502.regione.toscana.it/ows_idrogeologico/com.rt.wms.RTmap/wms?map=owsidrogeologico`; layer esatto `rt_idrogeol.idrd32671923.rt.poly`, identify text/plain. Fonte provinciale, ricognizione 2011–2012; strati delle aree boscate 2007/2010/2013/2016 separati. Firenze e Bagno vuoti, Vallombrosa positivo `id_idr=0480000001`. CORS `*`. Il [portale toscano](https://geoblog.regione.toscana.it/-/open-geodata) ammette CC BY/CC BY-SA, ma il metadato del singolo layer non è disponibile: commerciale **da confermare per questa risorsa**, non attribuire arbitrariamente CC BY 4.0.

Piemonte: WMS `https://geomap.reteunitaria.piemonte.it/ws/sifor/rp-01/aggvincidro10kwms/wms_vincidro10k_2016`, layer `VincIdro2016`; edizione 2016, scala 1:10.000, non sostituisce gli atti originali. [Metadati](https://www.geoportale.piemonte.it/geonetwork/srv/api/records/r_piemon:dl45po47-sh45-p44w-854d-58fdq6p9iu45/formatters/xml) CC BY 4.0: commerciale sì. Torino/Vercelli/Susa: identify text/plain con risposta vuota; nessun positivo confermato in questa sessione. CORS `*` osservato sulle richieste di ricerca quando presente nel manifest; non assumere CORS da quello del catalogo ARPA. Non collegato: manca qualificazione congiunta e certezza del layer toscano.

Curl verificato positivo Toscana:

```sh
curl -sS --fail-with-body --max-time 20 -G 'https://www502.regione.toscana.it/ows_idrogeologico/com.rt.wms.RTmap/wms?map=owsidrogeologico' \
  --data-urlencode 'service=WMS' --data-urlencode 'version=1.1.1' --data-urlencode 'request=GetFeatureInfo' \
  --data-urlencode 'layers=rt_idrogeol.idrd32671923.rt.poly' --data-urlencode 'query_layers=rt_idrogeol.idrd32671923.rt.poly' \
  --data-urlencode 'info_format=text/plain' --data-urlencode 'srs=EPSG:4326' --data-urlencode 'bbox=11.55595,43.73295,11.55605,43.73305' \
  --data-urlencode 'width=101' --data-urlencode 'height=101' --data-urlencode 'x=50' --data-urlencode 'y=50' \
  --data-urlencode 'feature_count=30' --data-urlencode 'format=image/png' --data-urlencode 'styles='
```

Lombardia ed Emilia-Romagna: cataloghi da approfondire; PAI e pericolosità non sono sinonimi del vincolo R.D.3267/1923. Nessun adapter basato sulla sola somiglianza del titolo.

## 5. Capacità d'uso dei suoli

Toscana: [pedologia](https://www.regione.toscana.it/pedologia), [scheda WMS](https://www502.regione.toscana.it/geoscopio/servizi/wms/PEDOLOGIA.htm). Endpoint `https://www502.regione.toscana.it/ows2/com.rt.wms.RTmap/wms?map=owspedologia`, layer esatto `capacita_di_uso_e_fertilita_dei_suoli`; text/plain, campi `lcc_classe`, `lcc_sottoc`, `lcc_cl_stc`, `nome_uc`. Scala 1:10.000. Firenze: unità urbana con attributi da qualificare; Bagno: III/swec; Vallombrosa: VI/ec. CORS `*`, aggiornamento specifico non accertato, licenza specifica non accertata; non collegato e niente equivalenza automatica «suolo agricolo di pregio».

Curl realmente verificato (Bagno, classe III/swec); le tre richieste esatte sono nel manifest (`pedo-*`):

```sh
curl -sS --fail-with-body --max-time 20 "https://www502.regione.toscana.it/ows2/com.rt.wms.RTmap/wms?map=owspedologia&service=WMS&version=1.1.1&request=GetFeatureInfo&layers=capacita_di_uso_e_fertilita_dei_suoli&query_layers=capacita_di_uso_e_fertilita_dei_suoli&info_format=text%2Fplain&srs=EPSG%3A4326&bbox=11.31995%2C43.69995%2C11.32005%2C43.700050000000005&width=101&height=101&x=50&y=50&feature_count=30&format=image%2Fpng&styles="
```

[ESDAC](https://esdac.jrc.ec.europa.eu/) offre prodotti pedologici e LUCAS, non una LCC certificata del lotto. [Licenza LUCAS 2009](https://esdac.jrc.ec.europa.eu/content/license-lucas-soil-data-2009): termini dedicati da distinguere dalla licenza del sito. Endpoint di identify LCC, geometrie equivalenti, commerciale e CORS non verificati. Non implementato; non interpolare campioni sparsi come misura del terreno.

## 6. Uso regionale e consumo di suolo

**UCS Toscana 2019:** WMS `https://www502.regione.toscana.it/wmsraster/com.rt.wms.RTmap/wms?map=wmsucs`, layer corretto `rt_ucs.iducs.10k.2019.rt.full`. Il nome senza `.full` restituisce LayerNotDefined: documentato e scartato. `GetFeatureInfo text/plain`, `ucs2019`/`des2019`. Fonte [metadati UCS](https://www502.regione.toscana.it/geonetwork/srv/ita/catalog.search#/metadata/r_toscan:0d4d6640-9a1c-47a4-9a5d-a85cdb36927c): **CC BY**, commerciale sì, versione non specificata; non inventare 4.0. Scala 1:10.000, data 2019; aggiornamenti non regolari. Firenze: 111, Bagno: 210, Vallombrosa: vuoto. CORS `*`.

```sh
curl -sS --fail-with-body --max-time 20 -G 'https://www502.regione.toscana.it/wmsraster/com.rt.wms.RTmap/wms?map=wmsucs' \
  --data-urlencode 'service=WMS' --data-urlencode 'version=1.1.1' --data-urlencode 'request=GetFeatureInfo' \
  --data-urlencode 'layers=rt_ucs.iducs.10k.2019.rt.full' --data-urlencode 'query_layers=rt_ucs.iducs.10k.2019.rt.full' \
  --data-urlencode 'info_format=text/plain' --data-urlencode 'srs=EPSG:4326' --data-urlencode 'bbox=11.31999,43.69999,11.32001,43.70001' \
  --data-urlencode 'width=101' --data-urlencode 'height=101' --data-urlencode 'x=50' --data-urlencode 'y=50' \
  --data-urlencode 'feature_count=100' --data-urlencode 'format=image/png' --data-urlencode 'styles='
```

**DUSAF Lombardia 7.0:** REST `https://www.cartografia.servizirl.it/arcgis1/rest/services/territorio/dusaf7/MapServer/1/query`, layer `1`, attributo `DESCR` (codice e testo, trattino normale o en dash). [Metadato](https://www.geoportale.regione.lombardia.it/metadati?_detailSheetMetadata_WAR_gptmetadataportlet_identifier=r_lombar%3A7cd05e9f-b693-4d7e-a8de-71b40b45f54e&p_p_id=detailSheetMetadata_WAR_gptmetadataportlet): **CC BY 4.0**, commerciale sì; ortofoto originarie AGEA non vengono ridistribuite. Copertura Lombardia; ripresa 2021, revisione 15/03/2023, aggiornamenti quando necessari. Scala 1:10.000, minimo 1.600 m² / 20 m. Milano: 12111, Lodigiano: 213, Valsassina: 31111. CORS riflette `Origin: https://particella.app`. Nel catalogo esiste anche DUSAF8: versione/licenza/metodo non qualificati, perciò si usa esplicitamente la release 7 verificata, senza chiamarla ultima.

```sh
curl -sS --fail-with-body --max-time 20 -G 'https://www.cartografia.servizirl.it/arcgis1/rest/services/territorio/dusaf7/MapServer/1/query' \
  --data-urlencode 'f=json' --data-urlencode 'geometry=9.329,45.307' --data-urlencode 'geometryType=esriGeometryPoint' \
  --data-urlencode 'inSR=4326' --data-urlencode 'spatialRel=esriSpatialRelIntersects' --data-urlencode 'outFields=*' --data-urlencode 'returnGeometry=false'
```

**ISPRA 10 m:** [accesso ufficiale ai dati](https://www.isprambiente.gov.it/it/attivita/suolo-e-territorio/suolo/il-consumo-di-suolo/i-dati-sul-consumo-di-suolo). Catalogo REST `https://sinacloud.isprambiente.it/arcgisina/rest/services/sina_consumo_suolo?f=pjson` interrogato; `Statistiche_consumo_suolo_2025` è territoriale, non un raster del lotto. `.../rest/services/suolo?f=pjson` restituisce HTTP 200 con errore JSON 499 Token Required. Nessuna percentuale impermeabilizzata esposta. Licenza/raster/versione/CORS dell'endpoint necessario non qualificati; CORS riflesso sui cataloghi non autorizza accesso ai raster. Non collegato, niente download nazionale pesante.

## 7. Siti contaminati, cave, discariche

[SISBON 2.0 Toscana](https://www.regione.toscana.it/istruzioni-operative-in-materia-di-bonifiche-sisbon-2.0), [passaggio di gestione ARPAT](https://www.arpat.toscana.it/sr_bon_competenze_arpat-html/): il portale amministrativo è distinto da dati aperti geometrici. [PSC-AGISCO Lombardia](https://www.regione.lombardia.it/ambiente-e-territorio/bonifica-aree-contaminate/portale-siti-contaminati) e [elenchi 31/12/2025](https://www.regione.lombardia.it/ambiente-e-territorio/bonifica-aree-contaminate/siti-bonificati%2C-contaminati-e-potenzialmente-contaminati) disponibili; gli elenchi escludono procedimenti SIN e non attestano contaminazione fuori dai siti censiti. API query geospaziale, geometrie, licenza commerciale e CORS non verificati; niente provider e nessun curl funzionante di identify dichiarato.

[Piano cave Toscana](https://www502.regione.toscana.it/geoscopio/servizi/wms/PIANO_REGIONALE_CAVE.htm): endpoint WMS `https://www502.regione.toscana.it/wmsraster/com.rt.wms.RTmap/wms?map=wmscave`, sola scheda verificata; layer di piano non equivale a cava dismessa, ripristinata o idonea. Licenza, query e seconda regione non qualificate: non implementato.

OSM query condivisa (esempio §2), tag `landuse=industrial|quarry|landfill`, raggio 2 km. Stesse licenza, data, CORS e condizioni Overpass. Geometrie reali e distanze, classificazione collaborativa; non misura contaminazione, non sostituisce anagrafe né determina regimi FER.

## 8. Distanze dalle infrastrutture

OSM query condivisa: `highway=motorway|trunk|primary|secondary`, `railway=rail`, `landuse=cemetery`, `amenity=grave_yard`, `man_made=water_well`. REST Overpass, dati ODbL, raggio 2 km, aggiornamento e CORS come §2. Fonte verificata nei punti urbani/agricoli/montani in due regioni. Distanza da geometrie censite, nessuna fascia legale applicata.

Limiti: non sono cercate tutte le strade locali, le relazioni OSM sono escluse, il dato non certifica uso pubblico, stato di esercizio o potabilità. Una way senza vertici nella bbox potrebbe mancare anche se attraversa l'area. Per norme e misure usare sede fisica dell'infrastruttura, classificazione amministrativa, atti e prescrizioni dell'ente; niente soglia uniforme costruita da tag OSM.

## 9. Pendenza ed esposizione

TINITALY INGV, WMS `https://tinitaly.pi.ingv.it/TINItaly_1_1/wms`, layer `tinitaly_dem`, `GetFeatureInfo application/json`, `GRAY_INDEX` in metri. [Download/licenza](https://tinitaly.pi.ingv.it/Download_Area1_1.html): CC BY 4.0, commerciale sì con attribuzione a Tarquini et al.; release 1.1 gennaio 2023, celle 10 m, Italia, CORS `*`. Non risulta un layer `tinitaly_aspect`; le unità di `tinitaly_slope` non sono assunte. Fallback già presente EU-DEM 25 m su OpenTopoData: dati Copernicus aperti, limiti hosting 1/s e 1.000/giorno, CORS non necessario al client perché query server-side.

Curl reale WMS (stessa richiesta del provider):

```sh
curl -sS --fail-with-body --max-time 20 -G 'https://tinitaly.pi.ingv.it/TINItaly_1_1/wms' \
  --data-urlencode 'service=WMS' --data-urlencode 'version=1.1.1' --data-urlencode 'request=GetFeatureInfo' \
  --data-urlencode 'layers=tinitaly_dem' --data-urlencode 'query_layers=tinitaly_dem' \
  --data-urlencode 'info_format=application/json' --data-urlencode 'srs=EPSG:4326' --data-urlencode 'bbox=9.19099,45.46479,9.19101,45.46481' \
  --data-urlencode 'width=101' --data-urlencode 'height=101' --data-urlencode 'x=50' --data-urlencode 'y=50' \
  --data-urlencode 'feature_count=100' --data-urlencode 'format=image/png' --data-urlencode 'styles='
```

Provider `terrain` invariato nella fonte: campioni interni, piano locale `z=a·est+b·nord+c`; pendenza `100·hypot(a,b)`, orientamento della discesa `(atan2(-a,-b)·180/π+360)%360`. Nuova metrica `aspect_estimate`: stima, non misura. Sotto 0,5% di pendenza, con punti insufficienti o collineari: `null`. `south_facing_share` resta `null` perché un piano medio non ricostruisce la distribuzione areale. Nessuna percentuale del lotto rivolta a sud inventata; serve una futura analisi raster con celle, NoData, confine e pesi areali verificati.

## 10. Banda ultralarga e altri dati

[Programma BUL open data descritto da AGID](https://www.agid.gov.it/it/agenzia/stampa-e-comunicazione/notizie/2016/06/17/online-il-nuovo-portale-sul-piano-strategico-banda-ultra-larga), endpoint legacy candidato `https://bandaultralarga.italia.it/wp-json/bul/v1/opendata?format=csv&level=region&id=09`: **fetch failed** in questa sessione. Endpoint attuale, licenza commerciale, aggiornamento e CORS non verificati. Un cantiere/comune coperto non significa un lotto allacciabile e non misura velocità disponibile: non implementato.

Possibili sviluppi successivi, tutti non verificati qui: zone agricole di pregio ufficiali in altre regioni, distanze da captazioni idropotabili ufficiali, scarichi/canali consortili, opere irrigue, centri di conferimento rifiuti e usi industriali con stato amministrativo. Servono licenze specifiche e la medesima matrice di chiamate; nessun riempimento da OSM per dati legali mancanti.

## Debug, prestazioni e contratto

Regressione AdE `43.7865,11.2010`: la query parcel risponde, `CP:CadastralZoning` bbox ±0.0001° risponde HTTP 200 con `ServiceException code=InvalidFormat`, testo «Richiesta non valida». Bbox ±0.00002° risponde con veri fogli. Identità confermata `it:D612:_:50:1102`; il foglio è letto dal risultato e accoppiato tramite riferimento, non dedotto. Il retry spaziale è limitato a due bbox, vale solo per errori di protocollo e lascia invariato il punto. Se fallisce ancora: 502 con messaggio comprensibile; niente nearest parcel. Tipo di ProtocolError preservato nella cache negativa.

I provider girano in parallelo, deadline layer 25 s; HTTP include attesa del limiter, retry e lettura del corpo. Il client ora cancella una richiesta upstream quando tutti i chiamanti hanno rinunciato, senza interrompere un chiamante ancora attivo della stessa richiesta deduplicata. Le richieste in coda cancellate non consumano lo slot successivo. Gli slot vengono rilasciati in `finally`. Test offline per un layer bloccato e un layer sano, coda cancellata e chiamanti condivisi.

I tre nuovi provider OSM hanno URL identico e condividono una richiesta per lotto. `regional-land-cover` ha timeout 12 s; OSM 22 s con al massimo un retry HTTP transitorio entro lo stesso limite; il report conserva lo stato individuale e non aspetta un provider oltre 25 s. Il limiter rimane in memoria per istanza: non è una quota globale serverless. Produzione OSM pubblica disabilitata; servizio dedicato e limite condiviso restano necessari.

Additivo: quattro `LayerId` (`power-grid`, `infrastructure-distances`, `industrial-sites`, `regional-land-cover`), gruppo `energia`; nessuna rimozione o modifica di campi Zod preesistenti. Due metriche di `terrain` aggiunte, senza cambiare le precedenti. Report: 17 layer. `src/content/layers.ts` e `GROUP_LABEL` aggiornati come richiesto. Le fixture ridotte non vengono usate per produrre valori live.

Benchmark riproducibile: `node --experimental-strip-types scripts/land-live.ts`. Ogni lotto usa un processo nuovo (cache HTTP, plot e layer fredde), due chiamate della route report con `at`, prima fredda e poi calda. Tre veri lotti: Milano `it:F205:_:390:61`, Bagno `it:A564:_:60:110`, Vallombrosa `it:H222:_:28:60`. Tempi: elaborazione del route handler inclusa risoluzione catastale, esclusi startup Next, trasporto HTTP e rendering. I tempi e stati correnti sono in `tests/land-live-results.json` (generato/ignorato); esito della consegna in `docs/backend/SESSION-C.md`. Un report caldo può conservare brevemente anche layer non disponibili: il tempo non dimostra completezza.
