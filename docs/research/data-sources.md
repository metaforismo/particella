# Fonti dati per Particella: verifica web e chiamate reali

**Verifica: 5 ottobre 2026.** Ricerca, senza codice applicativo, installazioni o commit. Gli endpoint sono stati chiamati con curl; condizioni, licenze e significato dei dati confrontati con documentazione primaria. Accesso gratuito, licenza del dato e condizioni dell'hosting sono verifiche distinte.

Il risultato più rilevante: **il WFS catastale ufficiale restituisce gratuitamente geometrie GML senza chiave**, con download massivi CC BY 4.0. ANNCSU offre un'API anonima per odonimi/civici; OMI permette consultazione pubblica di perimetri e quotazioni, pur mantenendo esportazioni massive nell'area riservata. La disciplina urbanistica rimane frammentata e richiede verifica comunale di vigenza e norme.

## Metodo, punti e significato degli esiti

| Punto | Latitudine | Longitudine | Uso |
|---|---|---|---|
| Milano, Piazza Duomo | 45.4642 | 9.1900 | Punto principale nazionale |
| Firenze, Piazza della Signoria | 43.7696 | 11.2558 | Secondo punto richiesto; è urbano |
| Bagno a Ripoli, area rurale | 43.7000 | 11.3200 | Prova aggiuntiva catasto, comune e griglia popolazione |
| Groane | 45.6350 | 9.0970 | Controllo positivo Natura 2000/NatDA |
| Torino | 45.0600 | 7.6700 | Prova urbanistica locale |
| Bologna | 44.4949 | 11.3426 | Prova mosaico PSC Emilia-Romagna |

Le fonti nazionali sono provate su Milano e Firenze dove il servizio lo consente. Un punto fuori regione non prova copertura di un dataset regionale: sono indicati controlli locali o limite della prova. Nessuna chiamata autenticata simulata. Download parziali raster/ZIP provano accesso al file, non estrazione del valore al punto.

- **✅**: richiesta riuscita e risposta utilizzabile per la capacità dichiarata; non certifica riuso commerciale, copertura totale, vigenza o SLA.
- **⚠️**: capacità parziale, licenza da chiarire, instabilità, dati non interpretati, chiave non disponibile o sola documentazione.
- **❌**: capacità non disponibile nel test, per esempio WFS disabilitato; non significa indisponibilità definitiva della fonte.

**CORS misurato** inviando `Origin: https://particella.example` e leggendo gli header: “sì” richiede `Access-Control-Allow-Origin: *` oppure origine riflessa; “no” include origine diversa/hardcoded. Non è un test browser end-to-end: header non semplici richiedono preflight. curl non applica CORS; un WMS senza CORS può comparire come immagine HTML ma non essere letto con fetch/WebGL o esportato da canvas senza proxy.

Limiti numerici riportati solo se pubblicati; nessuno stress test. DNS/TLS/timeout locali non provano guasto globale. HTTP 200 con ServiceException, HTML di login o errore JSON non è successo. Risposta vuota non significa “nessun vincolo/rischio”. Nessuno SLA dimostrato da queste prove isolate.

Comandi registrati, HTTP, CORS e hash delle risposte: [manifest.json](evidence/2026-10-05/manifest.json). Risposte selezionate nella stessa directory; grandi archivi e pagine con configurazione interna non sono redistribuiti. Nei curl seguenti sono rimossi solo output temporanei. Per binari aggiungere `-o file.tif` / `-o file.zip` / `-o file.pbf`. I risultati descrivono le versioni osservate, non una garanzia sulle future ripetizioni.


## 1. Geocoding e reverse: Nominatim, Photon e ANNCSU

### Nominatim OSM

Base `https://nominatim.openstreetmap.org`; REST JSON `/search` e `/reverse`; nessun layer OGC o chiave. Forward “Piazza Duomo, Milano” HTTP 200:

```json
{"lat":"45.4639102","lon":"9.1906398","name":"Piazza del Duomo","address":{"city":"Milano","municipality":"Rodano"}}
```

Reverse Milano: oggetto pedonale `1_33051`; Firenze: Piazza della Signoria 13, `43.7693536,11.2559695`. **Anomalia osservata:** `city` Milano corretto, `municipality` Rodano nel forward/reverse. Non ricavare comune competente/codice ISTAT da questa gerarchia: usare confini ISTAT (`3).

CORS sì `*`; **ODbL 1.0**, attribuzione OpenStreetMap. [Policy OSMF](https://operations.osmfoundation.org/policies/nominatim/): **1 richiesta/s per intera app**, User-Agent/Referer identificativo, cache, provider sostituibile; vietati autocomplete e scansioni sistematiche di griglie/POI. Bulk regolare max 4/min, singolo thread/macchina. Non adatto a rivendere API generica di geocoding; per prodotto pubblico carico modesto o self-host. Nessuno SLA. [Search](https://nominatim.org/release-docs/latest/api/Search/), [reverse](https://nominatim.org/release-docs/latest/api/Reverse/).

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://nominatim.openstreetmap.org/search?q=Piazza%20Duomo%2C%20Milano&format=jsonv2&limit=1&addressdetails=1'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://nominatim.openstreetmap.org/reverse?lat=45.4642&lon=9.1900&format=jsonv2&addressdetails=1'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://nominatim.openstreetmap.org/reverse?lat=43.7696&lon=11.2558&format=jsonv2&addressdetails=1'
```

### Photon

Base `https://photon.komoot.io`; REST GeoJSON `/api/` e `/reverse`, senza chiave, CORS `*`. Forward HTTP 200 `coordinates:[9.1906398,45.4639102]`. Reverse Milano: ATM Point; Firenze: memoriale Girolamo Savonarola. Sono POI vicini, non civici certificati. `lang=it` ha dato **400**, lingue dichiarate `default,de,en,fr`; ricerca senza lang riuscita.

[Provider/policy](https://github.com/komoot/photon): richieste ragionevoli, throttling/ban, nessuna quota numerica/SLA pubblicati. Software Apache 2.0, dati OSM ODbL. Istanza propria per carico stabile.

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://photon.komoot.io/api/?q=Piazza%20Duomo%20Milano&limit=1'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://photon.komoot.io/reverse?lat=45.4642&lon=9.1900&limit=1'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://photon.komoot.io/reverse?lat=43.7696&lon=11.2558&limit=1'
```

### ANNCSU: alternativa ufficiale italiana anonima

Ente AdE/ISTAT/Comuni. Base **`https://anncsu.open.agenziaentrate.gov.it/age-inspire/opendata/anncsu/`**, REST JSON `querydata.php`, CSV ZIP `getds.php`. Risorse esatte `odonimi` e `accessi`; help `querydata.php?help_show`. Nessuna chiave/login. CORS **no**, Allow-Methods presente ma Allow-Origin assente; quota/SLA numerici non trovati.

Forward in due passaggi: Comune/codice catastale → odonimo → civico. Non è un geocoder fuzzy né un reverse completo già dimostrato.

| Prova | HTTP | Estratto |
|---|---|---|
| F205 PIAZZA DEL DUOMO | 200 | `Progressivo_nazionale:1027247`, DUG PIAZZA, DUF DEL DUOMO |
| D612 PIAZZA DELLA SIGNORIA | 200 | `Progressivo_nazionale:1162919` |
| Accessi 1027247, accesso=1 | 200 | `Civico:1, CoordX:"9,1891545", CoordY:"45,4647938", Metodo:3`; 48 risultati |
| Accessi 1162919, accesso=13 | 200 | NERO `11,2559695;43,7693535` e ROSSO `11,2551971;43,769955`, Metodo 4 |

`accesso=1` ricerca parziale include 10/12/etc: filtrare civico/esponente/specificità esatti. Coordinate e quota sono stringhe con **virgola decimale**; [metadato ufficiale](https://www.anncsu.gov.it/.allegati/metadata_indirizzario.json) dichiara ETRF2000 epoch 2008 EPSG:6706 e metodi di georeferenziazione. Alcune righe prive di coordinate; completezza stradario non garantisce copertura/precisione del geocoding.

[Open data ANNCSU](https://www.anncsu.gov.it/it/consultazione-dellarchivio/open-data/) documenta CSV mensili, servizio consultazione giornaliero nella documentazione acquisita. [Consultazione ufficiale](https://www.anncsu.gov.it/it/consultazione-dellarchivio/ricerca-strade-e-numeri-civici/): **CC BY 4.0**. CAPTCHA della ricerca web distinto dall'API anonima provata.

`getds.php?STRAD_LOMB` / `?STRAD_TOSC` scaricati completi: `STRAD_LOMB_20260915.csv` / `STRAD_TOSC_20260915.csv`. Estratto `F205;015146;1027247;1;PIAZZA DEL DUOMO`. Indirizzari più grandi hanno raggiunto timeout dopo download parziale: **non completi/importati**. Affidabilità istituzionale buona; misurare coordinate mancanti per Comune.

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://anncsu.open.agenziaentrate.gov.it/age-inspire/opendata/anncsu/querydata.php?help_show'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://anncsu.open.agenziaentrate.gov.it/age-inspire/opendata/anncsu/querydata.php?resource=odonimi&codicecomune=F205&denominazione=PIAZZA+DEL+DUOMO'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://anncsu.open.agenziaentrate.gov.it/age-inspire/opendata/anncsu/querydata.php?resource=accessi&progressivoodonimo=1027247&accesso=1'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://anncsu.open.agenziaentrate.gov.it/age-inspire/opendata/anncsu/querydata.php?resource=odonimi&codicecomune=D612&denominazione=PIAZZA+DELLA+SIGNORIA'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://anncsu.open.agenziaentrate.gov.it/age-inspire/opendata/anncsu/querydata.php?resource=accessi&progressivoodonimo=1162919&accesso=13'
```


## 2. Catasto: WMS, WFS geometrico e download GML

**Sì, il poligono è ottenibile gratuitamente senza chiave.** Agenzia delle Entrate: WMS INSPIRE, WFS e download GML, tutti anonimi nelle prove. CORS **no** sui servizi/download testati.

| Capacità | URL base | Protocollo e nomi esatti |
|---|---|---|
| Visualizzazione/identificazione | `https://wms.cartografia.agenziaentrate.gov.it/inspire/wms/ows01.php` | WMS `CP.CadastralParcel`, `CP.CadastralZoning`, `strade`, `acque`, `fabbricati` |
| Geometria | `https://wfs.cartografia.agenziaentrate.gov.it/inspire/wfs/owfs01.php` | WFS 2.0 `CP:CadastralParcel`, `CP:CadastralZoning` |
| Archivi | `https://wfs.cartografia.agenziaentrate.gov.it/inspire/wfs/GetDataset.php` | ZIP GML regionali/nazionali, navigazione comunale |

Altri layer WMS: `province`, `codice_plla`, `vestizioni`, `simbolo_graffa`, `copyright`. **Punto nei Name WMS, due punti nei typename WFS.** WFS dichiara GML 3.2, CRS `urn:ogc:def:crs:EPSG::6706`; GeoJSON non tra i formati dichiarati. Schema: `msGeometry`, `INSPIREID_LOCALID`, `INSPIREID_NAMESPACE`, `LABEL`, `NATIONALCADASTRALREFERENCE`, `ADMINISTRATIVEUNIT`.

### Risultati sui tre punti

| Punto | Candidati WFS piccola bbox | Contiene il punto | Mappa da WMS zoning |
|---|---|---|---|
| Milano | 1 | `F205_039000.STRADA001` | `F205_039000`, **LABEL 390** |
| Firenze | `.67` e `.STRADA001` | `D612_017300.STRADA001` | `D612_017300`, **LABEL 173** |
| Bagno a Ripoli rurale | `.109` e `.110` | `A564_006000.110` | `A564_006000`, **LABEL 60** |

WFS **HTTP 200, geometrie GML reali**. Verifica locale degli anelli: Firenze .67 non contiene il punto; rurale .109 no, .110 sì. È prova di ricerca, non motore GIS completo: produzione gestisce CRS, buchi, multipoligoni e bordi.

I punti urbani ricadono su **strade**, non particelle ordinarie edificabili. WMS parcel lì vuoto; zoning/WFS identificano mappa/entità speciale. WMS parcel rurale positivo, label 110. `ADMINISTRATIVEUNIT` è F205/D612/A564: codice catastale, distinto dall'ISTAT.

**Non dividere identificativo eliminando zeri a intuito:** `_039000` non dimostra foglio “39”; il zoning restituisce esplicitamente **390**. Conservare riferimento completo, label della mappa, eventuali sezioni e convenzione documentata. `beginLifespanVersion` mappe: 2023-03-01 / 2025-09-02 / 2024-04-08; non data certa di ultima mutazione di ogni particella.

### Assi e CRS: errore realmente osservato

WMS supporta EPSG:6706/4258/3044/3045/3046/25832/25833/25834. **EPSG:4326 ha restituito HTTP 200 con ServiceException InvalidFormat**; 4326 e 3857 non risultano supportati. WMS 1.3.0 bbox 6706: latitudine,longitudine; WFS URI 6706/GML stesso ordine. Coordinate WGS84 usate numericamente come approssimazione nell'audit; backend deve trasformare realmente CRS per selezione/misure.

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://wfs.cartografia.agenziaentrate.gov.it/inspire/wfs/owfs01.php?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=CP%3ACadastralParcel&COUNT=10&BBOX=45.464099999999995%2C9.1899%2C45.4643%2C9.1901%2Curn%3Aogc%3Adef%3Acrs%3AEPSG%3A%3A6706'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://wfs.cartografia.agenziaentrate.gov.it/inspire/wfs/owfs01.php?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=CP%3ACadastralParcel&COUNT=10&BBOX=43.769499999999994%2C11.255700000000001%2C43.7697%2C11.2559%2Curn%3Aogc%3Adef%3Acrs%3AEPSG%3A%3A6706'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://wfs.cartografia.agenziaentrate.gov.it/inspire/wfs/owfs01.php?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=CP%3ACadastralParcel&COUNT=10&BBOX=43.6999%2C11.3199%2C43.700100000000006%2C11.3201%2Curn%3Aogc%3Adef%3Acrs%3AEPSG%3A%3A6706'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://wms.cartografia.agenziaentrate.gov.it/inspire/wms/ows01.php?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=CP.CadastralZoning%2Cstrade&QUERY_LAYERS=CP.CadastralZoning%2Cstrade&CRS=EPSG%3A6706&BBOX=45.4637%2C9.1895%2C45.4647%2C9.1905&WIDTH=101&HEIGHT=101&I=50&J=50&INFO_FORMAT=text%2Fhtml&FEATURE_COUNT=10&FORMAT=image%2Fpng&STYLES='

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://wms.cartografia.agenziaentrate.gov.it/inspire/wms/ows01.php?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=CP.CadastralZoning%2Cstrade&QUERY_LAYERS=CP.CadastralZoning%2Cstrade&CRS=EPSG%3A6706&BBOX=43.7691%2C11.2553%2C43.7701%2C11.2563&WIDTH=101&HEIGHT=101&I=50&J=50&INFO_FORMAT=text%2Fhtml&FEATURE_COUNT=10&FORMAT=image%2Fpng&STYLES='

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://wms.cartografia.agenziaentrate.gov.it/inspire/wms/ows01.php?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=CP.CadastralZoning%2Cstrade&QUERY_LAYERS=CP.CadastralZoning%2Cstrade&CRS=EPSG%3A6706&BBOX=43.6995%2C11.3195%2C43.7005%2C11.3205&WIDTH=101&HEIGHT=101&I=50&J=50&INFO_FORMAT=text%2Fhtml&FEATURE_COUNT=10&FORMAT=image%2Fpng&STYLES='
```


Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://wms.cartografia.agenziaentrate.gov.it/inspire/wms/ows01.php?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=CP.CadastralParcel&QUERY_LAYERS=CP.CadastralParcel&CRS=EPSG%3A6706&BBOX=43.6995%2C11.3195%2C43.7005%2C11.3205&WIDTH=101&HEIGHT=101&I=50&J=50&INFO_FORMAT=text%2Fhtml&FEATURE_COUNT=10&FORMAT=image%2Fpng&STYLES='
```

### Procedura punto → poligono

1. Trasformare punto nel CRS richiesto; WFS bbox piccola, paginazione/troncamento controllati.
2. Decodificare GML rispettando assi e conservare documento originale.
3. `ST_Covers(geometry,point)` dopo trasformazione coerente; mantenere candidati su bordo/ambiguità.
4. Zoning per mappa/foglio, codici e label originali; classificare strada/acqua/particella.
5. Snapshot GML comunale in PostGIS per ripetizioni; misure in CRS metrico locale. Non estrarre geometrie dalle immagini WMS.

[WFS ufficiale](https://www.agenziaentrate.gov.it/portale/cartografia-catastale-wfs), [download massivo](https://www.agenziaentrate.gov.it/portale/download-massivo-cartografia-catastale), [accesso](https://www.agenziaentrate.gov.it/portale/accedi-al-servizio-cartografici): **CC BY 4.0**, commerciale consentito con attribuzione; nazionale **escluse Province autonome Trento/Bolzano**. Pagine recuperate con curl, lettore web 403; WFS comunque funzionante. WFS aggiornato automaticamente, bulk **semestrale**. Massimo richieste simultanee dichiarato ma numero non reperito: basso parallelismo/coda, nessuna promessa illimitata.

Link pubblicato `GetDataset.php?dataset=LOMBARDIA.zip`: Range 0–1023 **301 → 206 ZIP**, destinazione `https://wfs-download.cartografia.agenziaentrate.eu/wfsdownload/LOMBARDIA.zip`. Solo 1024 byte provati, **non archivio completo/import nazionale**. Cartografia non fornisce proprietari, diritti, rendita o edificabilità.

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' -r 0-1023 'https://wfs.cartografia.agenziaentrate.gov.it/inspire/wfs/GetDataset.php?dataset=LOMBARDIA.zip'
```


## 3. Confini amministrativi e codice ISTAT dal punto

Base ufficiale `https://geoportale.istat.it/server/rest/services/LimAmm/LimitiAmministrativi/MapServer`; ArcGIS REST anonimo. ID **61 Comuni2026**, 60 Province2026, 59 Regioni2026. Query geometria `inSR=4326` con `esriSpatialRelIntersects`:

| Punto | HTTP | COMUNE | PRO_COM_T |
|---|---|---|---|
| Milano | 200 | Milano | `015146` |
| Firenze | 200 | Firenze | `048017` |
| Rurale | 200 | Bagno a Ripoli | `048001` |

`PRO_COM=15146` numerico: normalizzare stringa a sei cifre. SR nativo 3857, input 4326 accettato. CORS **sì**, origine riflessa/ACAC true. Nessun rate limit/SLA numerico trovato; maxRecordCount è limite di pagina, non quota.

[Confini ISTAT](https://www.istat.it/notizia/confini-delle-unita-amministrative-a-fini-statistici-al-1-gennaio-2018-2/): release **1 gennaio 2026**, shape generalizzati/non generalizzati EPSG:32632, a fini statistici, non confini certificati catastali a scala uniforme. [Note legali](https://www.istat.it/note-legali/): **CC BY 4.0 generale salvo eccezioni**; copyright REST vuoto, registrare questa base.

ZIP pubblicato `https://www.istat.it/storage/cartografia/confini_amministrativi/generalizzati/2026/Limiti01012026_g.zip`: curl DNS fallito, **non scaricato**. REST funzionante. Vecchio `gisportal.istat.it/server/rest/...` redirect a homepage HTML, non API valida. Snapshot annuale locale con storia fusioni/codici preferibile al reverse OSM.

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://geoportale.istat.it/server/rest/services/LimAmm/LimitiAmministrativi/MapServer/61/query?f=pjson&geometry=9.19%2C45.4642&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=%2A&returnGeometry=false'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://geoportale.istat.it/server/rest/services/LimAmm/LimitiAmministrativi/MapServer/61/query?f=pjson&geometry=11.2558%2C43.7696&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=%2A&returnGeometry=false'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://geoportale.istat.it/server/rest/services/LimAmm/LimitiAmministrativi/MapServer/61/query?f=pjson&geometry=11.32%2C43.7&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=%2A&returnGeometry=false'
```


## 4. Altimetria, profilo, pendenza

### TINITALY INGV: prima scelta italiana

Base `https://tinitaly.pi.ingv.it/TINItaly_1_1/`; WMS `/wms`, WCS `/wcs`, download GeoTIFF e WMTS documentati. GRATIS, nessuna chiave, **CC BY 4.0**, uso commerciale consentito con attribuzione a Tarquini et al. (2023), DOI `10.13127/tinitaly/1.1`. DTM terreno nudo, celle 10 m, release 1.1 gennaio 2023, UTM WGS84 32N EPSG:32632. Non confonderlo con un DSM degli edifici.

GetCapabilities **200**, nomi WMS esatti (il Title è diverso dal Name): `tinitaly_dem`, `tinitaly_hshd`, `tinitaly_hsv`, `tinitaly_od`, `tinitaly_slope`, `tinitaly_slope_2d5`, `tinitaly_svf_2d5`, `tinitaly_svf_ea`. ID coverage WCS2: `TINItaly_1_1__tinitaly_dem`, `TINItaly_1_1__tinitaly_slope` e analoghi. WCS1.0 usa `TINItaly_1_1:tinitaly_dem`.

GetFeatureInfo **200 JSON**: Milano `GRAY_INDEX:119.29900360107422`; Firenze `50.10205078125` (metri DTM). Slope restituisce `GRAY_INDEX:0.45938363671302795` e `0.047545697540044785`; **unità del layer slope non confermata dalle capabilities**, non etichettare automaticamente come gradi o percentuale. Alcuni cataloghi descrivono prodotti slope con enhancement: per valori fisici affidabili calcolare esplicitamente pendenza/aspect da DEM metrico, registrando formula, risoluzione e unità. WCS GetCoverage Milano **200 image/tiff**, 5×5 pixel, 1428 byte, TIFF magic `MM\0*`; prova reale della disponibilità raster, non analisi dei pixel.

CORS **sì `*`** su WMS/WCS e interrogazioni. Rate limit/SLA non pubblicati nelle pagine consultate; access constraints `none` nelle capabilities non equivale a quota illimitata. Affidabilità: ente ufficiale, release versionata, servizio risponde; cache/snapshot locale per analisi e report riproducibili. Download nazionale o tile scelti senza scaricare tutto a ogni report. [Fonte INGV](https://tinitaly.pi.ingv.it/), [WMS](https://tinitaly.pi.ingv.it/wms_service.html), [WCS](https://tinitaly.pi.ingv.it/wcs_service.html), [download CC BY](https://tinitaly.pi.ingv.it/Download_Area1_1.html).

### Open-Meteo elevation

Base `https://api.open-meteo.com/v1/elevation`, REST JSON, parametri `latitude` e `longitude` possono essere liste. Test doppio **200** `{"elevation":[147.0,65.0]}`. CORS **sì `*`**. API schema dice modello 90 m e licenza dati CC BY4.0. Attenzione distinta: **hosting gratuito solo non commerciale**, 10.000 chiamate/giorno secondo pricing, nessuna garanzia uptime; per Particella commerciale subscription/API key dedicata o self hosting. La differenza fra 147 m Open-Meteo e 119.299 m TINITALY a Milano vieta di presentare quote come rilievo topografico esatto o mediare dataset diversi. Una quota puntuale non dà pendenza/profilo del lotto. [OpenAPI ufficiale](https://github.com/open-meteo/open-meteo/blob/main/openapi/elevation.yml), [pricing e licenza hosting](https://open-meteo.com/en/pricing).

### OpenTopoData

Base `https://api.opentopodata.org/v1/`, REST JSON, dataset testato `eudem25m` (EU-DEM v1.1, 25m, EVRS2000; SRTM/ASTER derivato). Richiesta doppio punto **200**, Milano `127.84732818603516`, Firenze `62.43399429321289`, `status:OK`. CORS **no** nella risposta GET: proxy server necessario. Demo pubblico gratuito senza chiave: max 100 posizioni/richiesta, 1 chiamata/s, 1.000 chiamate/giorno. `samples` consente campionamento di un percorso, documentato ma non testato qui. Licenza EU-DEM Copernicus free/full/open con attribuzione, indicazione elaborazioni e nessuna implicita approvazione UE; non chiamarla MIT solo perché software open. Nessuno SLA. Buono fallback/prototipo; preferire dati nazionali scaricati per carichi reali. [Provider e limiti](https://www.opentopodata.org/), [API](https://www.opentopodata.org/api/), [dataset/licenza](https://www.opentopodata.org/datasets/eudem/).

### Copernicus DEM

GLO-30 e GLO-90 sono DSM, includono vegetazione/edifici, non DTM; EEA-10 non è open equivalente per pubblico generale. Accesso CDSE ha account e temporary credentials per download; **dal 25 agosto 2026 view service GLO30 ristretto alle categorie autorizzate**, quindi non promettere API Processing anonima gratis. [Collection ufficiale](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM), [variazione agosto2026](https://dataspace.copernicus.eu/news/2026-8-25-copernicus-dem-30m-view-service-update).

Alternativa verificata senza account: mirror AWS gestito da Sinergise, `https://copernicus-dem-30m.s3.amazonaws.com/`, protocollo HTTPS S3/COG raster (STAC catalogo separato). Tile `Copernicus_DSM_COG_10_N45_00_E009_00_DEM` (Milano) e `Copernicus_DSM_COG_10_N43_00_E011_00_DEM` (Firenze) **206 Partial Content** con `Range:bytes=0-16383`, `image/tiff`, totali44155932/45495124byte, Last-Modified2022-05-09. **Prova di accesso al tile che contiene il punto, nessuna quota puntuale decodificata in questa sessione**. CORS **no** su entrambi; lato server. Mirror è release2021, update frequency none, non assumere ultima release CDSE2024. Licenza specifica Copernicus WorldDEM30 free/open, non CC BY; include notice DLR/Airbus/EU/ESA richiesto anche per derivati. Quota/SLA non pubblicati dal registry, rete/compute selfhosting restano costi. [Registry/licenza/storage](https://registry.opendata.aws/copernicus-dem/), [licenza ufficiale](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf).

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS --max-time 30 -H 'Origin: https://particella.example' 'https://tinitaly.pi.ingv.it/TINItaly_1_1/wms?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=tinitaly_dem&query_layers=tinitaly_dem&styles=&srs=EPSG%3A4326&bbox=9.189%2C45.4632%2C9.190999999999999%2C45.465199999999996&width=101&height=101&x=50&y=50&format=image%2Fpng&info_format=application%2Fjson'

curl -sS --max-time 30 -H 'Origin: https://particella.example' 'https://tinitaly.pi.ingv.it/TINItaly_1_1/wms?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=tinitaly_dem&query_layers=tinitaly_dem&styles=&srs=EPSG%3A4326&bbox=11.254800000000001%2C43.7686%2C11.2568%2C43.770599999999995&width=101&height=101&x=50&y=50&format=image%2Fpng&info_format=application%2Fjson'

curl -sS --max-time 30 -H 'Origin: https://particella.example' 'https://tinitaly.pi.ingv.it/TINItaly_1_1/wms?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=tinitaly_slope&query_layers=tinitaly_slope&styles=&srs=EPSG%3A4326&bbox=9.189%2C45.4632%2C9.190999999999999%2C45.465199999999996&width=101&height=101&x=50&y=50&format=image%2Fpng&info_format=application%2Fjson'

curl -sS --max-time 30 -H 'Origin: https://particella.example' 'https://tinitaly.pi.ingv.it/TINItaly_1_1/wcs?service=WCS&version=1.0.0&request=GetCoverage&coverage=TINItaly_1_1:tinitaly_dem&crs=EPSG:4326&bbox=9.1898,45.4640,9.1902,45.4644&width=5&height=5&format=GeoTIFF'

curl -sS --max-time 60 -H 'Origin: https://particella.example' -A 'Particella research endpoint-validation' 'https://api.open-meteo.com/v1/elevation?latitude=45.4642,43.7696&longitude=9.1900,11.2558'

curl -sS --max-time 60 -H 'Origin: https://particella.example' -A 'Particella research endpoint-validation' 'https://api.opentopodata.org/v1/eudem25m?locations=45.4642,9.1900%7C43.7696,11.2558'

curl -sS --max-time 45 -H 'Origin: https://particella.example' -H 'Range: bytes=0-16383' https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N45_00_E009_00_DEM/Copernicus_DSM_COG_10_N45_00_E009_00_DEM.tif

curl -sS --max-time 45 -H 'Origin: https://particella.example' -H 'Range: bytes=0-16383' https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N43_00_E011_00_DEM/Copernicus_DSM_COG_10_N43_00_E011_00_DEM.tif
```


## 5. Dissesto idrogeologico — ISPRA IdroGEO

**Esito: ✅ interrogazione spaziale WMS provata; ❌ WFS non disponibile nel test.** Base `https://idrogeo.isprambiente.it/geoserver/ows`. Gratuito, senza chiave. WMS 1.1.1/1.3.0; `GetFeatureInfo` accetta `application/json` e restituisce geometrie GeoJSON e proprietà: offre più dati della sola immagine WMS, ma la query è comunque un'identificazione via pixel, non una vera intersezione catastale affidabile.

Layer esatti rilevati dalle capabilities e interrogati:

- `idrogeo:pericolosita_frane` — Pericolosità frane PAI.
- `idrogeo:pericolosita_idraulica_p1`, `idrogeo:pericolosita_idraulica_p2`, `idrogeo:pericolosita_idraulica_p3` — scenari idraulici bassa/media/elevata.
- `idrogeo:comuni_pir` — confine comunale + indicatori di rischio.
- `idrogeo:frane` — inventario IFFI, distinto dalle aree PAI; solo capabilities verificate per questo ulteriore layer, non query puntuale.

Tutte le query puntuali hanno HTTP 200 e payload valido. Milano Duomo: `numberReturned:0` per frane PAI/P1/P2/P3; Firenze centro: P1 e P2 presenti, P3 e frane PAI vuoti. Firenze P2, estratto delle proprietà: `{"id":29419,"scenariop2":"Aree a pericolosita' idraulica media P2"}`. Firenze P1: `{"id":27064,"scenariop1":"Aree a pericolosita' idraulica bassa P1"}`. I grossi MultiPolygon restituiti possono comprendere territori distanti; conservare l'intersezione spaziale e non assumere che l'intero poligono sia la zona locale minima.

`comuni_pir`: Milano `{"pro_com_t":"015146","comune":"Milano","pop_res021":1349930,"ar_id_p2":12.347}`; Firenze `{"pro_com_t":"048017","comune":"Firenze","pop_res021":361619,"ar_id_p2":38.128}`. I valori di rischio sono **comunali**; non descrivono il lotto e non sono popolazione corrente. I suffissi `011`/`021` conservano il riferimento dei censimenti. Il layer costituisce un'alternativa live per indicatori strutturati, senza dover dipendere da API private della SPA. Nessuna API REST indicatori è stata validata in questo audit.

**CORS:** assente sulle risposte WMS reali con `Origin: https://particella.example`; server proxy necessario per fetch JSON. **Limiti:** rate limit numerico non trovato nelle fonti ufficiali consultate; nessuno SLA verificato. Usare timeout, coda, cache e snapshot ufficiali. Il WFS GetFeature su tutti i medesimi layer risponde HTTP 200 **con** `<ows:Exception exceptionCode="ServiceUnavailable"><ows:ExceptionText>Service WFS is disabled</ows:ExceptionText>`: non è successo né feature collection vuota.

**Licenza e aggiornamento:** [licenza ufficiale pericolosità/indicatori ISPRA 2020](https://idrogeo.isprambiente.it/cms/wp-content/uploads/2022/03/Licenza_Condizioni_Uso_Pericolosita_Indicatori_Rischio_ISPRA.pdf): **CC BY-SA 4.0**, cita ISPRA e richiede stessa licenza per dati derivati. Quel documento identifica mosaicatura frane v4.0 2020–2021 e idraulica v5.0 2020; non attribuire automaticamente tali anni ai contenuti oggi restituiti. Il servizio live non espone una data di aggiornamento nelle proprietà interrogate: registrare `unknown` finché il pacchetto metadati della release non è acquisito. [IFFI ufficiale](https://www.progettoiffi.isprambiente.it/?page_id=68) conferma CC BY-SA4.0 anche per inventario, con attribuzione ISPRA + Regione/Provincia Autonoma. Per analisi a scala catastale ISPRA richiede integrazione con studi specifici; mosaicature pluriennali, completezza/aggiornamento non garantiti. [Pagina ISPRA IdroGEO](https://www.isprambiente.gov.it/it/archivio/notizie-e-novita-normative/notizie-ispra/2025/05/con-idrogeo-puoi-sapere-se-il-territorio-dove-vivi-e-a-rischio-frane-e-alluvioni) conferma consultazione e download di mosaicature e indicatori; [manuale](https://idrogeo.isprambiente.it/cms/wp-content/uploads/2025/10/Manuale_uso_applicazione_IdroGeo_Utente_v3_2025.pdf) descrive download shapefile + indicatori XLS/CSV/JSON con metadati e licenza. Strategia production: snapshot release in PostGIS per intersecare l'intera particella; live WMS come verifica/sfondo.

**Affidabilità osservata:** WMS rapido e funzionante per 10 interrogazioni; WFS disabilitato. Nessun dato trovato al punto significa «nessun oggetto restituito da questo layer a questa scala/versione», non «nessun rischio».

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://idrogeo.isprambiente.it/geoserver/ows?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=idrogeo%3Apericolosita_frane&query_layers=idrogeo%3Apericolosita_frane&info_format=application%2Fjson&srs=EPSG%3A4326&bbox=9.189%2C45.4632%2C9.190999999999999%2C45.465199999999996&width=101&height=101&x=50&y=50&feature_count=5'

curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://idrogeo.isprambiente.it/geoserver/ows?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=idrogeo%3Apericolosita_idraulica_p2&query_layers=idrogeo%3Apericolosita_idraulica_p2&info_format=application%2Fjson&srs=EPSG%3A4326&bbox=11.254800000000001%2C43.7686%2C11.2568%2C43.770599999999995&width=101&height=101&x=50&y=50&feature_count=5'

curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://idrogeo.isprambiente.it/geoserver/ows?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=idrogeo%3Acomuni_pir&query_layers=idrogeo%3Acomuni_pir&info_format=application%2Fjson&srs=EPSG%3A4326&bbox=9.189%2C45.4632%2C9.190999999999999%2C45.465199999999996&width=101&height=101&x=50&y=50&feature_count=5'

curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://idrogeo.isprambiente.it/geoserver/ows?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=idrogeo%3Acomuni_pir&query_layers=idrogeo%3Acomuni_pir&info_format=application%2Fjson&srs=EPSG%3A4326&bbox=11.254800000000001%2C43.7686%2C11.2568%2C43.770599999999995&width=101&height=101&x=50&y=50&feature_count=5'
```


## 6. Classificazione e pericolosità sismica

### DPC — classe del comune

**✅ CSV realmente scaricato, senza chiave.** Base `https://rischi.protezionecivile.gov.it/static/`; dataset collegato nella [pagina ufficiale classificazione](https://rischi.protezionecivile.gov.it/it/approfondimento/classificazione-sismica/), aggiornato **maggio 2025** (ultima release lì individuata). Nessun endpoint point-in-polygon del CSV: prima risolvere il comune ufficiale da geometria/confini, poi join sul codice ISTAT normalizzato a sei cifre. Il file originale usa codici numerici senza zero iniziale.

Estratto realmente letto:

```csv
REGIONE;PROV_CITTA_METROPOLITANA;SIGLA_PROV;COMUNE;COD_ISTAT_COMUNE;ZONA_SISMICA
Lombardia;Milano;MI;Milano;15146;3
Toscana;Firenze;FI;Firenze;48017;3
```

HTTP200; **CORS no** (nessun ACAO). Licenza [DPC note legali](https://www.protezionecivile.gov.it/it/approfondimento/note-legali-0/): **CC BY4.0** per contenuti e dati aggregati, salvo eccezioni; attribuzione prescritta «Fonte: Dipartimento della Protezione Civile-Presidenza del Consiglio dei Ministri». Rate limit numerico non trovato; un download per versione, cache annuale con controllo pagina, no query remota per report. **Affidabilità:** alta come snapshot istituzionale, non certificazione di requisiti tecnici. DPC chiarisce che la classe comunale serve al controllo/pianificazione; per costruzioni la pericolosità di base dipende dalle coordinate e dalle norme vigenti, non basta la zona comunale.

### INGV MPS04 — WFS realmente interrogabile

**✅ WMS + WFS ufficiali, HTTP200, chiave no, CORS `*`.** Base `https://mps04-ws.pi.ingv.it/wfs_mps04_pga`; WMS `https://mps04-ws.pi.ingv.it/wms_mps04_pga`. Il precedente `https://esse1-gis.mi.ingv.it/ows` non è il servizio da usare: il test aveva errore TLS, non prova di endpoint dati assente. Il [registro ufficiale INGV dei servizi](https://data.ingv.it/metadata/web_service_ita) collega i nuovi URL; [metadati dataset MPS04](https://data.ingv.it/dataset/193), realmente scaricati con curl (il web renderer aveva403), dichiarano **CC BY4.0**.

Tipo esatto testato WFS 2: `ms:shkValsPoeCost_PGA_50oPerc_10poe_`, PGA 50° percentile con probabilità di eccedenza10% in 50 anni. WMS stesso nome senza prefisso `ms:`. Altri percentili16/84 e PoE2/5/22/30/39/50/63/81 sono nelle capabilities; non tutti testati.

Il dataset è una **griglia di nodi** (non un poligono, non restituisce automaticamente PGA interpolata esattamente sul lotto). Query bbox intorno ai due punti reale, GML3.2:

- Milano: 4 nodi restituiti con `count=4`; primo `gml:pos=45.506700 9.142559`, `ms:id_punto=12038`, `ms:iml=0.04692`.
- Firenze: 2 nodi; primo `gml:pos=43.813930 11.273100`, `ms:id_punto=19837`, `ms:iml=0.13376`; secondo nodo più vicino al punto ha `gml:pos=43.763950 11.274890`, `ms:id_punto=20059`, `ms:iml=0.1302`.

Non chiamare il primo nodo «valore del lotto». Bbox WFS 2 EPSG4326 segue **latitudine,longitudine**; le coordinate GML pure. Per production prendere tutti i nodi necessari, dichiarare nearest/interpolazione/metodo e unità PGA (`g`, da modello), risoluzione e stato del modello. [Guida ufficiale MPS04-S1](https://esse1-gis.mi.ingv.it/mps04_help_eng.html) descrive rilascio 2004–2006. Rate limit/SLA non documentati nelle fonti consultate; griglia piccola adatta a snapshot locale versionato; MPS04 non sostituisce relazione geologica o calcolo professionale aggiornato.

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -L --max-time 20 -sS -H 'Origin: https://particella.example' https://rischi.protezionecivile.gov.it/static/4717c6a369cdc298b69730c9d740e39a/classificazione-sismica-aggiornata-maggio-2025.csv

curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://mps04-ws.pi.ingv.it/wfs_mps04_pga?service=WFS&version=2.0.0&request=GetFeature&typeNames=ms%3AshkValsPoeCost_PGA_50oPerc_10poe_&srsName=EPSG%3A4326&count=4&bbox=45.4142%2C9.139999999999999%2C45.514199999999995%2C9.24%2CEPSG%3A4326'

curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://mps04-ws.pi.ingv.it/wfs_mps04_pga?service=WFS&version=2.0.0&request=GetFeature&typeNames=ms%3AshkValsPoeCost_PGA_50oPerc_10poe_&srsName=EPSG%3A4326&count=4&bbox=43.7196%2C11.2058%2C43.819599999999994%2C11.305800000000001%2CEPSG%3A4326'
```


## 7. Aree protette, Natura2000 e paesaggio

### EEA Natura2000 — alternativa nazionale alla legacy PCN

**✅ REST ArcGIS ufficiale, senza chiave, due punti + controllo positivo reale.** Base `https://bio.discomap.eea.europa.eu/arcgis/rest/services/ProtectedSites/Natura2000Sites/MapServer`.

ID/nome esatti: `0` — `Habitats Directive Sites (pSCI, SCI or SAC)`; `1` — `Birds Directive Sites (SPA)`; `2` — `Habitats and Birds Directive Sites`. Query `0/query`, `1/query`, `2/query` testate per Milano/Firenze: tutti e tre i layer restituiscono `features:[]` ai due punti. Queste risposte sono osservazioni relative ai dataset e non certificazioni di assenza di vincoli.

Controllo positivo puntuale `lon9.097 lat45.635`: `{"SITECODE":"IT2050002","SITENAME":"Boschi delle Groane","MS":"IT","Area_ha":726.89196036321619}`. Anche query per SITECODE con geometria restituisce il poligono reale. [Città Metropolitana Milano](https://www.cittametropolitana.mi.it/aree-tematiche/ambiente-e-tutela-del-territorio/Parchi/sic/boschi_groane.html) identifica il sito IT2050002 come fonte ufficiale di controllo.

CORS **sì**, ACAO riflette `https://particella.example` e ACACtrue; GET semplice consentita. Versione dichiarata dal servizio **2024**, EEA copyright2025. [Metadati Natura2000](https://www.eea.europa.eu/en/datahub/datahubitem-view/6fc8ad2d-195d-40f4-bdec-576e7d1268e4) + [avvertenza viewer](https://natura2000.eea.europa.eu/html/Disclaimer.html) confermano release2024 dei paesi. [Metadati della specifica release vector 2024](https://sdi.eea.europa.eu/catalogue/datahub/api/records/91357f39-7866-41ce-b447-43905c364ec8/formatters/xsl-view?approved=true&language=eng&output=pdf): **CC BY 4.0**, titolare DG ENV, nessuna limitazione all’accesso pubblico. Il record collega espressamente il REST API/servizio WMS testato; metadata PDF salvato nelle evidenze. Rate limit numerico non trovato, nessuno SLA; leggere `maxRecordCount` e paginare per bulk, preferire snapshot ufficiale. Risposta vuota non esclude vincoli diversi.

### EEA NatDA/CDDA — aree protette nazionali, distinto da Natura2000

**✅ REST spaziale, senza chiave.** Base `https://bio.discomap.eea.europa.eu/arcgis/rest/services/ProtectedSites/CDDA_Dyna_WM/MapServer`; layer dettagliato `4` — `Nationally designated areas (NatDA) - Large scale viewing`. Altri ID0 punti,1 small scale poligoni,2 raster IUCN,3 medium scale poligoni. Query4 nei due centri: `features:[]`. Controllo positivo stesso punto Groane: `{"siteName":"Parco naturale delle Groane","nationalId":"EUAP1287","countryCode":"IT","iucnCategory":"IV","inspireIDVersionId":"2026","spatialDataDissemination":"public"}`. **Release2026** visibile nella risposta; [metadati ufficiali luglio2026](https://doi.org/10.2909/028003e7-7585-4d69-92fc-7f81e0cc2340) confermano edizione24 e **CC BY4.0**, nessuna limitazione pubblica per la versionepublic (ci sono restrizioni per alcuni paesi, non convertirle in dati mancanti italiani). CORS sì, origin riflesso. Rate limit/SLA non documentati; `maxRecordCount` è dimensione risposta, non quota. Conservare elenco nazionale e piani del gestore per effetti del vincolo.

### MASE Geoportale nazionale — legacy WMS

I [metadati istituzionali RNDT EUAP](https://geodati.gov.it/geoportale/visualizzazione-metadati/scheda-metadati?metadataid=m_amte%3A299FN3%3A06c67978-18c8-4da7-ff26-443d4f700c2d) indicano base `https://wms.pcn.minambiente.it/ogc`, mapfile **case sensitive** `/ms_ogc/WMS_v1.3/Vettoriali/EUAP.map` e WFS `/ms_ogc/wfs/EUAP.map`. SIC/ZPS legacy candidati `/ms_ogc/WMS_v1.3/Vettoriali/SIC.map`, `.../ZPS.map`.

**⚠️ Endpoint ufficiali corretti tentati ma curl fallisce DNS `Could not resolve host` dopo una prima fase in cui lo stesso host rispondeva per ortofoto.** Non è possibile confermare qui layer name, CORS o query puntuale EUAP/SIC/ZPS e non è corretto marcarli gratis/open per riuso in produzione solo perché pubblici. I tentativi iniziali con mapfile inventato `.../WMS/Natura2000.map` oppure `.../vector/Natura2000.map` hanno500 ma sono **percorsi non validati**, non prova che il servizio corretto sia down. [MASE metadati Progetto Natura](https://va.mite.gov.it/it-IT/DatiEStrumenti/MetadatoRisorsa/a32c56ee-0e34-42cc-a2f5-2e556e27fe95) conferma categorieEUAP/SIC/ZPS e serviziWMS/WFS. EEA è l'alternativa funzionante osservata; per norma e aggiornamento tornare a regioni/MASE e relativi atti.

### MiC SITAP — WMS nuovo reale

**✅ interrogazioni spaziali pubbliche; ⚠️ licenza di riuso non accertata.** Base `https://sitap.cultura.gov.it/geoserver/sitap_ws_clone/wms`. URL ricavato dal codice della homepage ufficiale pubblica, non ipotizzato. ProtocolloWMS 1.1.1, GetFeatureInfo `application/json`; capabilities espongono molte geometrie regionali.

Layer testati: `lombardia_art136` Milano — vuoto; `toscana_art136` Firenze —1feature, proprietà `{"BENE_NUM":136,"ID_BENE":9048136,"VIN_COD":"218-1953","PROV":"FI","SCALA":"10K","DATA_REV":"OTTOBRE 2012","VAL_MIBAC":"VALIDATO"}`.

Ulteriori nomi capabilities: `lombardia_art136_perimetri`, `lombardia_142_rispetto_fiumi`, `lombardia_142_boschi_e_foreste`, `toscana_art142_rispetto_fiumi`, `toscana_art142_montagne`, `toscana_art142_rispetto_laghi`; **non** testati spatial in questo audit e non tutte le categorie nazionali sono coperte. `Access-Control-Allow-Origin: https://sitapdev.cultura.gov.it` hardcoded, quindi **CORS no per Particella** anche se è presente un ACAO; proxy server.

[Pagina MiC SITAP](https://cultura.gov.it/sitap-sistema-informativo-territoriale-ambientale-e-paesaggistico) specifica non esaustività, variabilità dell'accuratezza, natura ricognitiva e nessuna valenza certificativa. [Repertorio ufficiale ICA](https://ica.cultura.gov.it/geoportale/repertorio-preliminare-delle-banche-dati-territoriali-reperibili-on-line/siti-portali-del-mibac-su-scala-nazionale-o-sovraregionale/) conferma accesso pubblico/riservato ma **non fornisce una licenza aperta per il dataset SITAP**. Non trasferire la CC BY del Catalogo Beni Culturali aSITAP. Rate policy numerica e SLA non trovati. Affidabilità tecnica positiva, affidabilità giuridica solo supporto ricognitivo; data 2012 della feature mostra la necessità di confrontare il PPR regionale vigente.

### Vincoli in Rete

Base pubblica linkata dal MiC `https://vincoliinrete.beniculturali.it/VincoliInRete/vir/utente/login`; curl reale **HTTP 503** con messaggio di chiusura notturna per sicurezza informatica **fra le 20:00 e le 7:00** (prova di notte in Italia). CORS `*` sulla pagina 503; nessun endpoint spaziale/API né licenza verificato. Non dimostra indisponibilità durante gli orari di apertura. [FAQ ufficiali SABAP Cremona/Mantova/Lodi](https://sabapcrmnlo.cultura.gov.it/faqs/) chiariscono: dati di base consultabili liberamente, provvedimenti da scaricare previa autenticazione; il sistema non è un elenco esaustivo di decreti, vincoli indiretti riferiti al bene tutelato. **⚠️ servizio non integrabile come API anonima dimostrata.** Per eventuali prove future partire dal manuale e contatti ufficiali; non aggirare accesso né automatizzare download degli atti senza condizioni chiarite.

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://bio.discomap.eea.europa.eu/arcgis/rest/services/ProtectedSites/Natura2000Sites/MapServer/0/query?f=json&geometry=9.19%2C45.4642&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=%2A&returnGeometry=false'

curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://bio.discomap.eea.europa.eu/arcgis/rest/services/ProtectedSites/Natura2000Sites/MapServer/0/query?f=json&geometry=11.2558%2C43.7696&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=%2A&returnGeometry=false'

curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://bio.discomap.eea.europa.eu/arcgis/rest/services/ProtectedSites/Natura2000Sites/MapServer/0/query?f=json&geometry=9.097%2C45.635&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=SITECODE%2CSITENAME%2CMS%2CArea_ha&returnGeometry=false'

curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://bio.discomap.eea.europa.eu/arcgis/rest/services/ProtectedSites/CDDA_Dyna_WM/MapServer/4/query?f=json&geometry=9.097%2C45.635&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=%2A&returnGeometry=false'

curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://sitap.cultura.gov.it/geoserver/sitap_ws_clone/wms?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=lombardia_art136&query_layers=lombardia_art136&info_format=application%2Fjson&srs=EPSG%3A4326&bbox=9.189%2C45.4632%2C9.190999999999999%2C45.465199999999996&width=101&height=101&x=50&y=50&feature_count=5'

curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://sitap.cultura.gov.it/geoserver/sitap_ws_clone/wms?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=toscana_art136&query_layers=toscana_art136&info_format=application%2Fjson&srs=EPSG%3A4326&bbox=11.254800000000001%2C43.7686%2C11.2568%2C43.770599999999995&width=101&height=101&x=50&y=50&feature_count=5'
```

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' https://vincoliinrete.beniculturali.it/VincoliInRete/vir/utente/login
```


## 8. Servizi nei dintorni — Overpass

Base `https://overpass-api.de/api/interpreter`; Overpass QL via HTTP POST REST JSON. Nessuna chiave. Query testata `nwr(around:400,lat,lon)` su `amenity=school|hospital|clinic|pharmacy`, `public_transport`, `shop`, output center/tags: **200** Milano 420 elementi, Firenze 525 elementi. Excerpt Milano: nodo715904515, coordinate45.4648556,9.1893457, `amenity:pharmacy`, `name:Farmacia Carlo Erba`; Firenze nodo1465244781 `name:Farmacia del Corso`. `osm3s.timestamp_osm_base`2026-10-05T21:35:40Z/21:36:40Z, copyright ODbL. Sono dati crowdsourced; tag `source:Ministero della Salute` non trasforma la risposta in un feed ufficiale ministeriale. Copertura di esercizi/scuole non garantita, `out center` restituisce centro bbox per ways/relations, non ingresso pedonale né distanza stradale.

CORS **sì `*`**. Licenza dati **ODbL1.0**, attribution ©OpenStreetMap contributors e attenzione obblighi database derivato; dati OSM gratuiti e commercialmente riusabili non significano backend pubblico unlimited. La policy dice circa10.000 richieste/giorno e 1 GB/giorno come guideline, slot/cooldown dinamici,429/504possibili, e identifica l'app pubblica non rivolta a mapper che dipende dal servizio pubblico come uso problematico. Per prodotto a regime estratti OSM/selfhosting o servizio con accordo; caching query/radius/tiles e circuit breaker. [Policy ufficiale provider](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html), [copyright/licenza OSM](https://www.openstreetmap.org/copyright).

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS --max-time 60 -H 'Origin: https://particella.example' -A 'Particella research endpoint-validation' --data-urlencode 'data=[out:json][timeout:25];(nwr(around:400,45.4642,9.19)[amenity~"^(school|hospital|clinic|pharmacy)$"];nwr(around:400,45.4642,9.19)[public_transport];nwr(around:400,45.4642,9.19)[shop];);out center tags;' https://overpass-api.de/api/interpreter

curl -sS --max-time 60 -H 'Origin: https://particella.example' -A 'Particella research endpoint-validation' --data-urlencode 'data=[out:json][timeout:25];(nwr(around:400,43.7696,11.2558)[amenity~"^(school|hospital|clinic|pharmacy)$"];nwr(around:400,43.7696,11.2558)[public_transport];nwr(around:400,43.7696,11.2558)[shop];);out center tags;' https://overpass-api.de/api/interpreter
```


## 9. Isocrone di accessibilità

### Valhalla FOSSGIS pubblico

**Usabile senza chiave per prova**: API `https://valhalla1.openstreetmap.de/isochrone`; `valhalla.openstreetmap.de` è UI, non base API. REST GET con JSON URL encoded, oppure POST secondo docs. Costing esatti `auto`,`pedestrian`; contorni time minuti. Milano auto10min e Firenze pedestrian10min **200 GeoJSON FeatureCollection**, geometry `Polygon`, properties `contour:10.0`,`metric:time`; primi vertici Milano `[9.205,45.47526]`, Firenze `[11.2558,43.775722]`. CORS **sì `*`**. Software MIT; dati OSM ODbL con attribution. Demo fair use come OSRM/Nominatim, limite prudenziale1req/s, nessuno SLA. Per app agli utenti maintainer chiede avviso via GitHub Discussions e header identificativo `X-Client-Id`; non abbiamo inviato alcun messaggio. Uso commerciale dei dati consentito, disponibilità demo non è impegno commerciale. Isocrone sono stime del grafo: non attestano traffico attuale, permessi ZTL o affidabilità marciapiedi. [Docs/demo/policy](https://valhalla.github.io/valhalla/), [Isochrone API](https://valhalla.github.io/valhalla/api/isochrone/api-reference/).

### OSRM FOSSGIS

Base `https://routing.openstreetmap.de/routed-car/route/v1/driving/`, REST JSON; anche routed-foot/routed-bike documentati dall'host ma qui testata auto. Milano destinazione(+.01,+.01): **200** `code:Ok`, distanza2396.8m,durata385.5s; Firenze2320.9m,353.9s. CORS **sì `*`**. Policy **1richiesta/s**, no heavy usage/scraping, user agent valido, attribution + fix-the-map link. Grafo aggiornato circa2giorni. **Route funziona, OSRM non espone endpoint standard isochrone**: non venderlo come alternativa drop-in per poligoni di accessibilità. Software BSD2-Clause, dati OSM ODbL. [Host e policy](https://routing.openstreetmap.de/about.html), [API ufficiale](https://project-osrm.org/docs/v5.24.0/api/).

### openrouteservice / HeiGIT

Base `https://api.openrouteservice.org/v2/isochrones/{profile}`, REST POST JSON, profili `driving-car`,`foot-walking`, locations ordine lon/lat, range secondi. **Chiave gratuita via account necessaria**. Curl anonimo Milano realmente eseguito: **401** `{"error":"Authorization field missing"}`; non abbiamo chiave e non dichiariamo poligono verificato. OPTIONS preflight **204**, ACAO `*`, methodsOPTIONS,GET,POST; CORS sì per preflight, response autenticata non verificata. Homepage ufficiale conferma500 isocrone/giorno free; pagina staging indica20/min ma non la trattare come quota attuale verificata. Plans/TOS live redirect ad account.heigit.org SPA che il web reader non espone; verificare dashboard della chiave prima produzione. Restrizioni documentate max5locations,10intervalli,120kmrange; auto max1h,foot20h. Software LGPL3.0, dati OSM ODbL, attribution del servizio da rispettare; uso commerciale/condizioni del piano da confermare sulle TOS correnti prima impegno. [Homepage500/day](https://openrouteservice.org/), [plans correnti](https://account.heigit.org/info/plans), [TOS](https://account.heigit.org/info/tos), [restrizioni](https://openrouteservice.org/restrictions/).

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS --max-time 60 -H 'Origin: https://particella.example' -A 'Particella research endpoint-validation' 'https://valhalla1.openstreetmap.de/isochrone?json=%7B%22locations%22%3A%5B%7B%22lat%22%3A45.4642%2C%22lon%22%3A9.19%7D%5D%2C%22costing%22%3A%22auto%22%2C%22contours%22%3A%5B%7B%22time%22%3A10%7D%5D%2C%22polygons%22%3Atrue%7D'

curl -sS --max-time 60 -H 'Origin: https://particella.example' -A 'Particella research endpoint-validation' 'https://valhalla1.openstreetmap.de/isochrone?json=%7B%22locations%22%3A%5B%7B%22lat%22%3A43.7696%2C%22lon%22%3A11.2558%7D%5D%2C%22costing%22%3A%22pedestrian%22%2C%22contours%22%3A%5B%7B%22time%22%3A10%7D%5D%2C%22polygons%22%3Atrue%7D'

curl -sS --max-time 60 -H 'Origin: https://particella.example' -A 'Particella research endpoint-validation' 'https://routing.openstreetmap.de/routed-car/route/v1/driving/9.1900,45.4642;9.2000,45.4742?overview=false'

curl -sS --max-time 60 -H 'Origin: https://particella.example' -A 'Particella research endpoint-validation' 'https://routing.openstreetmap.de/routed-car/route/v1/driving/11.2558,43.7696;11.2658,43.7796?overview=false'

curl -sS --max-time 30 -H 'Origin: https://particella.example' -H 'Content-Type: application/json' --data '{"locations":[[9.19,45.4642]],"range":[600]}' https://api.openrouteservice.org/v2/isochrones/driving-car

curl -sS --max-time 30 -H 'Origin: https://particella.example' -X OPTIONS -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: authorization,content-type' https://api.openrouteservice.org/v2/isochrones/driving-car
```


## 10. Esposizione solare — PVGIS JRC e SunCalc

PVGIS API base `https://re.jrc.ec.europa.eu/api/v5_3/`, GET REST JSON/CSV, nessuna chiave/login. Tool esatti `PVcalc`,`SHScalc`,`MRcalc`,`DRcalc`,`seriescalc`,`tmy`,`printhorizon`. TestPVcalc1kWp,loss14%,angle0default,aspect0default **200**: Milano `radiation_db:PVGIS-SARAH3`,years2005–2023,elevation131m, `E_y:1123.93`kWh/anno e `H(i)_y:1470.24`kWh/m²/anno; Firenze1158.66 e1507.31 rispettivamente. `use_horizon:true`,`horizon_db:DEM-calculated`: orizzonte DEM non implica ombreggiamento di palazzi/alberi vicini. Conservare inclination/loss/database/versione/anni, altrimenti comparazioni sono fuorvianti.

CORS **no**, confermato header e policy che proibisce accesso AJAX: chiamate obbligatoriamente backend. Limite **30 chiamate/s/IP**,429e529overloaded, retry/backoff; GET only, HEAD204, altri metodi405. Informazioni gratuite **senza restrizioni d'uso** secondo condizioni specifiche JRC; no chiave né clausola non commerciale, citare JRC/versione/dataset. Affidabilità ente UE, versione5.3 verificata; nuove6beta/documentazione esistono, mantenere versione esplicita. [API ufficiale](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/api-non-interactive-service_en), [condizioni uso](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/general-information/usage-conditions-data-protection_en).

SunCalc è calcolo locale, **nessun endpoint**: sole/alba/tramonto/azimuth/elevation a data/ora e coordinate, BSD2-Clause. Non installato né eseguito perché sessione ricerca. Proposta server-side riproducibile, libreria/versione bloccata e timezoneEurope/Rome; distingue sole astronomico, ombre di edifici e irraggiamento climatologico PVGIS. **SunCalc2.0 cambia unità/convenzioni**: corrente repo dà altitude/azimuth in gradi, azimuth clockwisefromnorth, vecchi esempi in radianti da sud non applicabili senza pin versione. [Repo/docs/licenza ufficiale](https://github.com/mourner/suncalc).

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS --max-time 60 -H 'Origin: https://particella.example' -A 'Particella research endpoint-validation' 'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=45.4642&lon=9.1900&peakpower=1&loss=14&outputformat=json'

curl -sS --max-time 60 -H 'Origin: https://particella.example' -A 'Particella research endpoint-validation' 'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=43.7696&lon=11.2558&peakpower=1&loss=14&outputformat=json'
```


## 11. Demografia: CSV comunali e griglia censuaria

### Popolazione comunale, ZIP ufficiali scaricati

Base `https://demo.istat.it/data/posas/`, HTTPS CSV ZIP senza chiave; join ISTAT del `3. HTTP 200 completi: `POSAS_2026_it_015_Milano.zip` 95.582 byte, `POSAS_2026_it_048_Firenze.zip` 31.353 byte.

```csv
Codice comune;Comune;Età;Totale maschi;Totale femmine;Totale
015146;Milano;999;663800;699063;1362863
048017;Firenze;999;171535;190090;361625
```

**Stima al 1 gennaio 2026**, non censimento definitivo attuale. Età 999=riga totale: non sommare totale e singole età; filtrare il Comune fra tutti quelli provinciali. [DEMO ISTAT](https://demo.istat.it/app/?i=POS&l=it) descrive stime provvisorie. CC BY 4.0 generale ISTAT, CORS **no**, rate/SLA non pubblicati: scaricare per versione, non per report.

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' https://demo.istat.it/data/posas/POSAS_2026_it_015_Milano.zip

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' https://demo.istat.it/data/posas/POSAS_2026_it_048_Firenze.zip
```

### Griglia censuaria 2021: API spaziale riuscita

Base `https://geoportale.istat.it/server/rest/services/Griglia/GrigliaCensPop2021_1kmq_Ind/MapServer`; REST **2 LegendaEstesa**, 3 LegendaSintetica. HTTP 200, nessuna chiave, CORS origine riflessa.

| Punto | GRD_ID | TOT_P_2021 | M / F | <15 / 15–64 / ≥65 |
|---|---|---|---|---|
| Milano | `CRS3035RES1000mN2483000E4257000` | 6906 | 3240 / 3666 | 798 / 4462 / 1646 |
| Firenze | `CRS3035RES1000mN2296000E4422000` | 8131 | 3898 / 4233 | 768 / 5351 / 2012 |
| Rurale | `CRS3035RES1000mN2288000E4427000` | 99 | 48 / 51 | Presenti nel payload |

[Griglia ISTAT](https://www.istat.it/notizia/statistiche-sulla-popolazione-per-griglia-regolare/): celle **1 km²**, anno 2021, griglia europea EPSG:3035; REST pubblicato in 3857. Popolazione della cella, non residenti del lotto/edificio. Ripartizione areale sugli intorni è stima da esplicitare.

CSVZIP nazionale `https://www.istat.it/wp-content/uploads/2023/07/GrigliaPop2021_Ind_ITA_CSV.zip`: DNS fallito, non scaricato. [Sezioni/variabili censuarie](https://www.istat.it/notizia/basi-territoriali-e-variabili-censuarie/): snapshot con join geografico, non API di persone.

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://geoportale.istat.it/server/rest/services/Griglia/GrigliaCensPop2021_1kmq_Ind/MapServer/2/query?f=pjson&geometry=9.19%2C45.4642&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=%2A&returnGeometry=false'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://geoportale.istat.it/server/rest/services/Griglia/GrigliaCensPop2021_1kmq_Ind/MapServer/2/query?f=pjson&geometry=11.2558%2C43.7696&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=%2A&returnGeometry=false'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://geoportale.istat.it/server/rest/services/Griglia/GrigliaCensPop2021_1kmq_Ind/MapServer/2/query?f=pjson&geometry=11.32%2C43.7&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=%2A&returnGeometry=false'
```

### SDMX: documentato, runtime non riuscito

Base `https://esploradati.istat.it/SDMXWS/rest/`. [Documentazione](https://www.istat.it/classificazioni-e-strumenti/web-services-sdmx/): **5 query/min/IP**, blocco 1–2 giorni se superate. `dataflow/IT1/all/latest` timeout curl 28 a 25s; nessun dataflow/schema/dimensione confermato qui. Non inventare query popolazione. MVP CSV+griglia REST, poi ingestione SDMX mirata con cache e dimensioni verificate; CORS non accertato. Licenza generale ISTAT CC BY 4.0.


## 12. OMI: perimetri e prezzi pubblici, bulk con login

[Forniture ufficiali OMI](https://www.agenziaentrate.gov.it/portale/schede/fabbricatiterreni/omi/forniture-dati-omi-cittadini): esportazioni massive gratuite quotazioni/perimetri/NTN tramite area riservata; login **non eseguito**. Licenza **CC BY 4.0**, attribuzione **“Agenzia delle Entrate – OMI”**. Pagina acquisita con curl, lettore web 403.

Base anonima `https://www1.agenziaentrate.gov.it/servizi/geopoi_omi/`. Provati endpoint usati dal client pubblico **senza riutilizzare chiavi incorporate nella pagina**. Non costituiscono contratto API versionato per terzi: adapter e schema possono cambiare.

| Endpoint relativo | Capacità | Esito |
|---|---|---|
| `zoneomi.php?richiesta=5` | Semestri | 200 JSON, prima voce `SEMESTRE:20252` |
| `zoneomi.php?richiesta=3&codcom=F205` | Zone | B12 `LINK_ZONA:MI00003228`, CENTRO STORICO-DUOMO |
| `zoneomi.php?richiesta=6&codcom=F205&semestre=20252` | Geometrie | 200 wrapper `cod:0,dat:FeatureCollection`; Milano 43 / Firenze 34 feature |
| `perimetri.php?id=1&prov=MI&codcom=F205&semestre=20252&formato=kml` | Perimetri | 200 ZIP/KML valido, Milano 81.503 / Firenze 63.615 byte |
| `zoneomi.php?richiesta=8&codcom=F205&semestre=20252&zo=B12` | Destinazioni | Residenziale, Commerciale, Produttiva, Terziaria |
| `stampaomi.php?F205/MI00003228/20252/R/B12/9.19/45.4642` | Prezzi | 200 HTML, tabella quotazioni |

CORS **sì `*`** sui JSON/perimetri/quotazioni testati; JSON talvolta Content-Type text/html. No rate numerico/SLA documentati. `index.htm` con coordinate risponde soltanto shell: non è point query.

KML 2025/2 realmente aperti e geometrie confrontate col punto: **Milano B12**, **Firenze B5**, quest'ultima `LINK_ZONA:FI00001135`. Quote interrogate su tali zone:

| Punto/zona/semestre | Tipologia/stato | Compravendita €/m² | Locazione €/m²/mese | Superficie |
|---|---|---|---|---|
| Milano B12 2025/2 | Abitazioni civili NORMALE | 8.700–10.900 | 25–35 | Lorda |
| Firenze B5 2025/2 | Abitazioni civili NORMALE | 3.600–5.300 | 11–14,2 | Lorda |

Estratto HTML `Abitazioni civili | NORMALE | 8700 | 10900 | L | 25 | 35 | L`. Sono intervalli zona/tipologia/stato, **non stima del bene o prezzo del terreno**; conservare L/N, stato, semestre, eventuali rettifiche/legenda.

Trappole osservate: `formato=KML` produce ZIP con estensione .kml ma GML `OMIFeatureCollection`; `formato=kml` produce KML 2.2 corretto. Alcune geometrie JSON richiedono validazione topologica degli anelli; preferire KML e non assumere ogni ring interno come buco.

Affidabilità istituzionale positiva, accesso anonimo provato, adapter web fragile. Snapshot semestrale, controlli parser, import ufficiale autorizzato per produzione. Ultima voce osservata 2025/2: non promettere prezzi 2026. Nessun accesso ai proprietari.

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://www1.agenziaentrate.gov.it/servizi/geopoi_omi/zoneomi.php?richiesta=5'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://www1.agenziaentrate.gov.it/servizi/geopoi_omi/zoneomi.php?richiesta=6&codcom=F205&semestre=20252'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://www1.agenziaentrate.gov.it/servizi/geopoi_omi/zoneomi.php?richiesta=6&codcom=D612&semestre=20252'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://www1.agenziaentrate.gov.it/servizi/geopoi_omi/perimetri.php?id=1&prov=MI&codcom=F205&semestre=20252&formato=kml'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://www1.agenziaentrate.gov.it/servizi/geopoi_omi/perimetri.php?id=1&prov=FI&codcom=D612&semestre=20252&formato=kml'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://www1.agenziaentrate.gov.it/servizi/geopoi_omi/stampaomi.php?F205/MI00003228/20252/R/B12/9.19/45.4642'

curl -sS -L --connect-timeout 10 --max-time 25 -A 'Particella-source-research/0.1 (manual endpoint verification)' -H 'Origin: https://particella.example' 'https://www1.agenziaentrate.gov.it/servizi/geopoi_omi/stampaomi.php?D612/FI00001135/20252/R/B5/11.2558/43.7696'
```


## 13. Pianificazione urbanistica: copertura regionale e comunale

Verifica reale: **5 ottobre 2026**, richieste con `Origin: https://particella.example`. I servizi regionali non costituiscono un mosaico nazionale omogeneo né certificano automaticamente l'edificabilità: scala, stato del piano, varianti, data di efficacia e NTA devono essere verificati per il Comune. Un layer che visualizza l'esistenza di un piano comunale non equivale alla zonizzazione di un lotto.

### Lombardia: PGT Tavola delle Previsioni, funzionante; vecchio PRG da tenere distinto

**Fonte/ente:** Regione Lombardia, dati consegnati dai Comuni. Il [SIT integrato regionale](https://www.regione.lombardia.it/ambiente-e-territorio/pianificazione-territoriale/pianificazione-comunale-e-provinciale/sit-integrato-per-la-pianificazione-comunale) documenta la consegna dei livelli e l'efficacia del PGT alla pubblicazione sul BURL. Il [Geoportale](https://www.geoportale.regione.lombardia.it/strumenti) descrive la Tavola delle Previsioni come sintesi a scala 1:10.000 e come elaborato non conformativo del Documento di Piano. Sono necessarie le norme e tavole del Piano delle Regole/Piano dei Servizi.

- **Base WMS:** `https://www.cartografia.servizirl.it/arcgis1/services/territorio/tav_previsioni_b/MapServer/WMSServer`
- **Base REST:** `https://www.cartografia.servizirl.it/arcgis1/rest/services/territorio/tav_previsioni_b/MapServer`
- **Layer WMS esatti:** `Ambiti_del_tessuto_urbano_consolidato46429`, `Ambiti_di_trasformazione6662`, `Aree_agricole10182`, `Modalità_attuative19664`, `Nuclei_di_antica_formazione4976`, `Servizi_e_impianti48535`, `Ambiti_di_rigenerazione_urbana_e_territoriale18618`. REST rispettivamente ID 20, 13, 19, 11, 12, 18, 14. Capabilities ottenute HTTP 200, 54.572 byte.
- **Milano Duomo:** GetFeatureInfo HTTP 200, GeoJSON con `MILANO`, `COD_ISTAT=15146` (normalizzare a `015146`), `DCOD_DEST1=RESIDENZIALE`, `DSPEC_DEST=Commerciale`; include URL scheda `https://www.cartografia.servizirl.it/schede_pgt/015146/015146_20200205_AU_23.pdf`. Questa data nel nome non è attestazione di aggiornamento al 2026.
- **CORS:** sì, `Access-Control-Allow-Origin: https://particella.example`, `Access-Control-Allow-Credentials: true`, `Vary: Origin`, su WMS e REST testati.
- **Chiave/costo:** nessuna per gli endpoint testati. Rate limit/SLA non pubblicati nelle fonti esaminate. REST servizio espone `maxRecordCount=1000`; è limite di pagina, non quota giornaliera.
- **Licenza:** non accertata a livello di questo dataset nella scheda recuperata; le capabilities hanno `Fees` e `AccessConstraints` vuoti. Non trasferire automaticamente CC-BY da altri layer del Geoportale. Accesso tecnico gratuito verificato; riuso commerciale da qualificare con il metadato esatto.
- **WFS:** candidato `/MapServer/WFSServer?service=WFS&request=GetCapabilities` ha dato HTTP 400. Nessun WFS funzionante dimostrato per questo servizio; REST restituisce geometrie con `returnGeometry=true`.

Richieste realmente riuscite:

```bash
curl -L --max-time 30 -sS -H 'Origin: https://particella.example' \
 'https://www.cartografia.servizirl.it/arcgis1/services/territorio/tav_previsioni_b/MapServer/WMSServer?service=WMS&request=GetCapabilities'

curl -L --max-time 30 -sS -H 'Origin: https://particella.example' \
 'https://www.cartografia.servizirl.it/arcgis1/services/territorio/tav_previsioni_b/MapServer/WMSServer?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&SRS=EPSG:4326&BBOX=9.18,45.4542,9.2,45.4742&WIDTH=101&HEIGHT=101&X=50&Y=50&LAYERS=Ambiti_del_tessuto_urbano_consolidato46429&QUERY_LAYERS=Ambiti_del_tessuto_urbano_consolidato46429&STYLES=&FORMAT=image/png&INFO_FORMAT=application/geo%2Bjson'

curl -L --max-time 30 -sS -H 'Origin: https://particella.example' \
 'https://www.cartografia.servizirl.it/arcgis1/rest/services/territorio/tav_previsioni_b/MapServer/20/query?f=pjson&geometry=9.1900,45.4642&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false'
```

Estratto della risposta WMS (proprietà):

```json
{"NOME_COM":"MILANO","COD_ISTAT":"15146","AMB_URB":"23","DCOD_DEST1":"RESIDENZIALE","DSPEC_DEST":"Commerciale","SCHEDA_NEW":"https://www.cartografia.servizirl.it/schede_pgt/015146/015146_20200205_AU_23.pdf"}
```

**Trappola verificata:** `territorio/Azzonamenti_comunali/MapServer/0/query` risponde e restituisce anche il poligono su Duomo, ma con `PRG=A-SC`, `ARTICOLO=37`, `DESCRI_PRG=Servizi comunali in zona A`. È un'altra base di dati, senza vigenza/data chiarita; non usarla come PGT vigente. WMS candidato `.../Azzonamenti_comunali/MapServer/WMSServer` HTTP 400.

### Toscana: stato regionale dei piani; zonizzazione vera del PO Firenze

**Servizio regionale:** [scheda Geoscopio STRUMENTI_URBANISTICI](https://www502.regione.toscana.it/geoscopio/servizi/wms/STRUMENTI_URBANISTICI.htm), ente Regione Toscana Direzione Urbanistica. Base `https://www502.regione.toscana.it/ows2/com.rt.wms.RTmap/wms?map=owsstrumentiurbanistici`. Layer exact `rt_strumenti_urbanistici.operativi_vigenti-lr65/14`, `rt_strumenti_urbanistici.strutturali_vigenti-lr65/14`, `rt_strumenti_urbanistici.operativi_vigenti-lr65/14ru`, `rt_strumenti_urbanistici.comuni_vigenti`; esistono livelli separati di piani decaduti e delle precedenti leggi. **Sono poligoni comunali con stato/iter del piano, non zone urbanistiche dettagliate.** La scheda stessa richiede il Comune per attestazione. [Policy WMS Toscana](https://www.regione.toscana.it/servizi-wms): licenze Creative Commons, dati pubblicati con finalità divulgativa, non tutti ufficiali; versione CC specifica di questo layer non verificata. Nessuna chiave; quote/SLA non pubblicate. HTTP 200, CORS `*`, metodi GET/POST/OPTIONS. GML restituito contiene warning per tag XML con `/`: parser rigorosi potrebbero rifiutarlo; preferire altro formato dichiarato o normalizzazione controllata.

```bash
curl -L --max-time 30 -sS -H 'Origin: https://particella.example' \
 'https://www502.regione.toscana.it/ows2/com.rt.wms.RTmap/wms?map=owsstrumentiurbanistici&SERVICE=WMS&REQUEST=GetCapabilities'

curl -L --max-time 30 -sS -H 'Origin: https://particella.example' \
 'https://www502.regione.toscana.it/ows2/com.rt.wms.RTmap/wms?map=owsstrumentiurbanistici&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&SRS=EPSG:4326&BBOX=11.2458,43.7596,11.2658,43.7796&WIDTH=101&HEIGHT=101&X=50&Y=50&LAYERS=rt_strumenti_urbanistici.operativi_vigenti-lr65/14&QUERY_LAYERS=rt_strumenti_urbanistici.operativi_vigenti-lr65/14&STYLES=&FORMAT=image/png&INFO_FORMAT=application/vnd.ogc.gml'
```

Estratto su Firenze: `FIRENZE`, `048017`, `L.R. 65/14 PO ordinaria (art. 17/18/19)`, date `2019/12/24`, `2023/03/13`, `2024/03/27`, fase `Attuazione`. Non interpretare queste date come data di efficacia senza leggere lo schema.

**PO Firenze:** vero servizio di disciplina urbanistica comunale, distinto dal regionale. [Catalogo PO classificazione vigente](https://opendata.comune.fi.it/page_dataset_show?id=po_classificazione_vigente) e [serie Piano Operativo](https://opendata.comune.fi.it/page_dataset_show?id=piano-operativo) pubblicano WMS e CC-BY 4.0. Base `https://tms.comune.fi.it/tiles/service/wms`. Layer exact `poc:v_po_timewms_subsistemi_ambiti_vigente`, `poc:v_po_timewms_classificazione_vigente`, `poc:v_po_timewms_areetrasformazione_vigente`, `poc:v_po_timewms_dotazioniterritoriali_vigente`; le versioni `..._adottato` sono separate. Capabilities HTTP 200 (senza tiled 699.629 byte), GetFeatureInfo GML positivo sul punto Firenze per subsistemi. **CORS no**: header ACAO assente nelle risposte testate; proxy per fetch e report. Nessuna chiave; limiti/SLA non indicati; affidabilità tecnica discreta con incongruenze di formati/tile.

```bash
curl -L --max-time 30 -sS -H 'Origin: https://particella.example' \
 'https://tms.comune.fi.it/tiles/service/wms?request=GetCapabilities&service=WMS&version=1.3.0'

curl -L --max-time 30 -sS -H 'Origin: https://particella.example' \
 'https://tms.comune.fi.it/tiles/service/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&SRS=EPSG:4326&BBOX=11.2458,43.7596,11.2658,43.7796&WIDTH=101&HEIGHT=101&X=50&Y=50&LAYERS=poc:v_po_timewms_subsistemi_ambiti_vigente&QUERY_LAYERS=poc:v_po_timewms_subsistemi_ambiti_vigente&STYLES=&FORMAT=image/png&INFO_FORMAT=application/vnd.ogc.gml'
```

Estratto realmente ricevuto:

```xml
<poc:gid>21</poc:gid>
<poc:tipologia>PO_SSA_ANS</poc:tipologia>
<poc:descrizione>ambito del nucleo storico (zona A - sottozona A1)</poc:descrizione>
<poc:data_inizio>2025-06-06</poc:data_inizio>
<poc:data_fine>2999-12-30</poc:data_fine>
```

Il punto richiesto `43.7696,11.2558` è nel centro urbano di Firenze, non rurale. Sullo stesso punto `classificazione_vigente` e `dotazioniterritoriali_vigente` hanno dato FeatureCollection vuota, mentre `subsistemi_ambiti_vigente` positivo: **vuoto non significa assenza di disciplina**. `INFO_FORMAT=application/json` HTTP 400 «not supported», formato GML funzionante. `GetMap` su bbox arbitraria ha dato HTTP 400 per tile index fuori griglia GeoWebCache: configurare correttamente griglia tile oppure usare servizio origin ufficialmente documentato; non assumere qualunque bbox funzionante. Le capabilities contengono OnlineResource intranet: non utilizzabile dall'esterno.

### Piemonte: Torino azzonamento interrogabile; mosaico regionale non certificato in questa sessione

Il catalogo regionale e RNDT forniscono un servizio comunale ufficiale ospitato da infrastruttura regionale, non un mosaico completo di tutti i Comuni. [RNDT Zone di piano](https://geodati.gov.it/geoportale/visualizzazione-metadati/scheda-metadati?metadataid=c_l219%3A71bd559a-de54-4ebc-84c4-4c304a53a720) conferma **CC-BY 4.0**, ente Comune Torino, revisione dato **2025-06-30**, metadati **2025-10-24**, aggiornamento quando necessario; download Shapefile indicato ma non scaricato. [Città Metropolitana Torino](https://www.cittametropolitana.torino.it/node/5609) mantiene un osservatorio mosaicatura PRG, ma il suo endpoint OGC operativo non è stato dimostrato qui.

- **Base WMS:** `https://geomap.reteunitaria.piemonte.it/ws/siccms/coto-01/wmsg01/wms_sicc23_prg_azzonamento`
- **Layer esatti:** `AreeDiPiano`, `ZonediPiano`, `Servizi`, `PUSP`, `PertStor`, `EdifTessSt`. Gruppo `PRGAzzonamento`.
- **HTTP 200**, CORS `*`, senza chiave; capabilities 32.460 byte, Fees «no conditions apply», AccessConstraints «None». Nessuna quota/SLA pubblicata nelle fonti esaminate. Scale massime pubblicate: `AreeDiPiano`/`ZonediPiano` 25.001, `PUSP` 10.001: interrogare a scala locale.
- **Punto aggiuntivo dichiarato:** Torino lat **45.0600**, lon **7.6700**, per provare una regione diversa da Lombardia/Toscana. La query ha restituito R2, zona B, ZUSA3. Query su Piazza Castello `45.0703,7.6861` prima con bbox ampia e poi ridotta: nessun risultato. Non trattarlo come indisponibilità dell'intero servizio.

```bash
curl -L --max-time 30 -sS -H 'Origin: https://particella.example' \
 'https://geomap.reteunitaria.piemonte.it/ws/siccms/coto-01/wmsg01/wms_sicc23_prg_azzonamento?SERVICE=WMS&REQUEST=GetCapabilities'

curl -L --max-time 30 -sS -H 'Origin: https://particella.example' \
 'https://geomap.reteunitaria.piemonte.it/ws/siccms/coto-01/wmsg01/wms_sicc23_prg_azzonamento?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&SRS=EPSG:4326&BBOX=7.669,45.059,7.671,45.061&WIDTH=101&HEIGHT=101&X=50&Y=50&LAYERS=ZonediPiano,AreeDiPiano,Servizi&QUERY_LAYERS=ZonediPiano,AreeDiPiano,Servizi&STYLES=&FORMAT=image/png&INFO_FORMAT=text/plain'
```

Estratto:

```text
Layer 'AreeDiPiano'
  Feature 4156:
    id_ap = 'R2'
    area_di_piano = 'Residenza R2'
    desc_dm_1444 = 'Zona di categoria B'
Layer 'ZonediPiano'
  Feature 4156:
    codice = 'ZUSA3'
    zona_di_piano = 'Zona Urbana Storico Ambientale 3'
```

### Emilia-Romagna: PSC regionale pubblicato, query parziale; non equipararlo ai nuovi PUG

**Base WMS:** `https://servizigis.regione.emilia-romagna.it/wms/piani_strutturali_comunali`. [Metadato RNDT del servizio](https://geodati.gov.it/geoportale/visualizzazione-metadati/scheda-metadati?metadataid=r_emiro%3A2016-04-01T154059) conferma **CC-BY 4.0**, ente Regione Emilia-Romagna, data metadati 2025-12-30; non prova aggiornamento di ogni piano. Capabilities ottenute dopo retry HTTP 200, 47.037 byte; primo tentativo timeout a 25s dopo header HTTP 200. CORS riflette `https://particella.example`. Chiave nessuna, quote/SLA non pubblicate.

Layer exact dalle capabilities: `S_ASS_PL` (assetto), `S_TER_PL` (macroclassificazione), `S_DOT_PL`, `S_DOT_LI`, `S_DOT_PT` (dotazioni), `S_MOB_PL`, `S_MOB_LI`, `S_MOB_PT` (mobilità). Si tratta di PSC, non prova di un mosaico PUG corrente. [Catalogo RNDT strati](https://geodati.gov.it/geoportale/visualizzazione-metadati/scheda-metadati?metadataid=r_emiro%3AS_DOT_LI_2014) descrive anche download shape e modello di scambio. Copertura comunale e sostituzione con PUG devono essere verificati individualmente.

```bash
curl -L --max-time 45 -sS -H 'Connection: close' -H 'Origin: https://particella.example' \
 'https://servizigis.regione.emilia-romagna.it/wms/piani_strutturali_comunali?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities'

curl -L --max-time 30 -sS -H 'Connection: close' -H 'Origin: https://particella.example' \
 'https://servizigis.regione.emilia-romagna.it/wms/piani_strutturali_comunali?service=WMS&version=1.3.0&request=GetFeatureInfo&crs=EPSG:4326&bbox=44.4939,11.3416,44.4959,11.3436&width=101&height=101&i=50&j=50&layers=S_TER_PL&query_layers=S_TER_PL&styles=&format=image/png&info_format=text/xml'
```

Punto aggiuntivo Bologna `44.4949,11.3426`, risposta HTTP 200 XML vuota:

```xml
<FeatureInfoResponse xmlns:esri_wms="http://www.esri.com/wms" xmlns="http://www.esri.com/wms"></FeatureInfoResponse>
```

La query WMS 1.1.1 su `S_ASS_PL,S_TER_PL` ha dato HTTP 400 pagina Regione. Un successivo 1.3.0 JSON su Reggio Emilia `44.6983,10.6312` ha restituito FeatureCollection vuota; Imola `44.3533,11.7147` ha restituito ServiceException `LayerNotDefined` nonostante il layer comparisse nelle capabilities. **Stato ⚠️**, non integrazione puntuale affidabile dimostrata.

Alternative comunali documentate: [Unione Valli e Delizie PUG](https://www.unionevalliedelizie.fe.it/vivere-l-unione/websit-del-pug-dell-unione-valli-e-delizie) espone ArcGIS REST `https://sit.unionevalliedelizie.fe.it/arcgis/rest/services/APPRO_PUG_4/MapServer` per disciplina interventi diretti, `/APPRO_PUG_6` per territorio rurale, CC-BY 4.0. `curl` ha fallito DNS `Could not resolve host`, nessun layer exact/query positivo ottenuto. Candidato Bologna `https://sitmappe.comune.bologna.it/arcgis/rest/services/PUG/PUG_0_PER_ORIENTARSI/MapServer?f=pjson`: HTTP 200 contiene errore applicativo 500 «Service ... not found», directory PUG vuota. Non confondere HTTP 200 con servizio utile.

### Veneto: WMS/WFS pubblici vivi, mosaico PI/PAT dettagliato non dimostrato

[IDT2 Veneto](https://idt2.regione.veneto.it/) pubblica la base **`https://idt2-geoserver.regione.veneto.it/geoserver/ows`**, WMS/WFS senza chiave. Entrambe capabilities HTTP 200, WMS 1.722.208 byte, WFS 619.686 byte. CORS riflette `https://particella.example`, credenziali true. Esistono layer di contesto `rv:c1103015400_tessutourbanizzato`, `rv:c1103015192_urbanlaborrovigo`: **non costituiscono zonizzazione vigente dei PI/PAT**. La presenza di un layer chiamato `rv:zonizzazione_072026` da sola non ne prova il significato urbanistico. Nessuna query positiva di zonizzazione dettagliata dimostrata. Licenza puntuale dei candidati non accertata; rate limit/SLA non indicati.

```bash
curl -L --max-time 30 -sS -H 'Origin: https://particella.example' \
 'https://idt2-geoserver.regione.veneto.it/geoserver/ows?service=WMS&request=GetCapabilities'
curl -L --max-time 30 -sS -H 'Origin: https://particella.example' \
 'https://idt2-geoserver.regione.veneto.it/geoserver/ows?SERVICE=WFS&REQUEST=GetCapabilities'
```

[Policy infrastruttura](https://www.regione.veneto.it/web/ambiente-e-territorio/infrastruttura-dati-territoriali): dati pubblici accessibili a tutti, altri dati del Quadro Conoscitivo destinati a Province/Comuni previa autenticazione. [Pagina downloader](https://idt2.regione.veneto.it/idt/downloader/download.) descrive email e login per specifici pacchetti. Strategie: cercare singolo Comune/PI, validare WMS/WFS e metadati; non promettere copertura urbanistica regionale completa.

### Puglia: servizi PRG/PUG comunali pubblicati; test bloccato dalla catena TLS

[SIT regionale](https://pugliacon.regione.puglia.it/web/sit-puglia-sit/info-e-contatti2) dichiara PUG adottati/approvati e servizi WMS, ma non si è dimostrato un unico mosaico di zonizzazione nazionale/regionale.

Il [SIT Area Vasta Metropoli Terra di Bari](https://sit.egov.ba.it/it/wms/) pubblica WMS comunali exact:

| Comune | Piano | Base pubblicata |
|---|---|---|
| Bari | PRG | `http://sit.egov.ba.it/ows/bari/qdjango/89/` |
| Binetto | PRG | `http://sit.egov.ba.it/ows/urbanistica-binetto/qdjango/26/` |
| Bitetto | PUG | `http://sit.egov.ba.it/ows/urbanistica-bitetto/qdjango/38/` |
| Bitonto | PRG | `http://sit.egov.ba.it/ows/urbanistica-bitonto/qdjango/30/` |
| Cassano delle Murge | PRG | `http://sit.egov.ba.it/ows/urbanistica-cassano-delle-murge/qdjango/22/` |
| Molfetta | PRG | `http://sit.egov.ba.it/ows/urbanistica-molfetta/qdjango/27/` |
| Terlizzi | PRG | `http://sit.egov.ba.it/ows/urbanistica-terlizzi/qdjango/33/` |

Test reale candidato Bari:

```bash
curl -L --max-time 25 -sS -H 'Origin: https://particella.example' \
 'http://sit.egov.ba.it/ows/bari/qdjango/89/?service=WMS&request=GetCapabilities'
```

Risultato: HTTP 301 verso HTTPS, poi `curl: (60) SSL certificate problem: unable to get local issuer certificate`. La homepage HTTPS ha la stessa anomalia nel trust store locale. **Non bypassata TLS**; non prova che ogni client pubblico fallisca. Layer exact, CORS, licenza puntuale, rate limit e query Bari non verificati; nessuna chiave richiesta dal link, ma la homepage [spiega profili anonimi/SPID](https://sit.egov.ba.it/it/) con strumenti urbanistici normalizzati aggiuntivi dietro SPID. Accessibilità WMS non implica accessibilità di ogni funzione/CDU.

### Strategia operativa

1. Registro provider per Regione/Comune con ambito di copertura, tipo di piano, scala, layer exact, capacità `identify`/`geometry`/`render`, licenza, date del dato e del metadato, stato vigente/adottato/decaduto. Scegliere l'adattatore tramite codice ISTAT, non solo coordinate.
2. Mosaici regionali come discovery e sintesi; comune e suoi documenti come riscontro della disciplina e vigenza. Query sul poligono del lotto, non solo centroide, per intercettare zone multiple. WFS/REST per intersezioni quando disponibili; WMS GetFeatureInfo dà attributi, non garantisce geometria o completa disciplina.
3. Indicizzare NTA ufficiali con ente, piano/variante, delibera, BURL/bollettino, efficacia, URL, hash, pagina/articolo. Consentire upload utente di NTA/PDF indicando esplicitamente provenienza utente e vigenza non verificata; mai sostituire tacitamente una fonte ufficiale con un upload.
4. RAG vincolato al Comune, versione e articoli pertinenti; citazioni pagina/articolo e link. Calcoli di indici/superfici deterministici soltanto con numeri e definizioni espliciti nelle norme; l'AI descrive condizioni e incertezze. Nessuna inferenza «edificabile» da solo uso suolo o categoria generica.
5. Cache server dei risultati con versione del provider, query e data; snapshot licenziati per geometrie/documenti quando ammesso. Risultati `no_features`, `unavailable`, `unknown_coverage`, `license_unverified` distinti da «nessun vincolo». Report non equivalente a CDU.

## 14. Consumo di suolo, uso del suolo e ortofoto

### ISPRA/SNPA consumo di suolo

**⚠️ pagina snapshot e testo di licenza recuperati; licenza incoerente e live pixel non semanticamente pronto.** [Pagina ufficiale ISPRA](https://www.isprambiente.gov.it/it/attivita/suolo-e-territorio/suolo/il-consumo-di-suolo/i-dati-sul-consumo-di-suolo) collega [repository nazionale2024](https://groupware.sinanet.isprambiente.it/uso-copertura-e-consumo-di-suolo/library/consumo-di-suolo/carta-nazionale-consumo-suolo-2024): `SC_2024_RDN_v7`,549MB, e2023v7; GeoTIFF 10 m, release v7.0 del24/10/2025. Il file grande **non** è stato scaricato; pagina download e TXTlicenza sì.

Il TXTlicenza realmente letto contiene incoerenza letterale: `"Licenza Attribuzione 3.0 Italia (CC BY 4.0 IT)"` e link `https://creativecommons.org/licenses/by/4.0/it/legalcode`. Annotare **CC BY 4.0 menzionata nel testo, titolo 3.0 e URL incoerenti; verifica formale necessaria**, non correggere silenziosamente inCC BY3.0. [TXTlicenza](https://groupware.sinanet.isprambiente.it/uso-copertura-e-consumo-di-suolo/library/consumo-di-suolo/carta-nazionale-consumo-suolo-2024/licenza/download/en/1/licenza.txt).

BaseREST `https://sinacloud.isprambiente.it/arcgisadv/rest/services/Consumo_Suolo` (lo stesso `/arcgis/rest/services` dava404; path `arcgisadv` necessario). Servizi esatti interrogati:

- `SC_LAEA_2022_v4_1_125_205/ImageServer`,1bandaU8,10m, identify a entrambi punti restituisce `"value":"NoData"`; è un sottoinsieme125..205, non base completa per rilevare «non consumato».
- `SC_2021_LAEA_v3/ImageServer`,**3bandeRGB**, identify a entrambi punti restituisce `"value":"230, 0, 0"`; è un valore colore, **non** codice classe. Non tradurre automaticamente in suolo consumato senza legenda/mapping release. Metadati e identify HTTP 200.

**CORS sì**, origin riflesso suREST. Rate numerico/SLA non trovati. Per analisi poligono nel backend usare **GeoTIFF ufficiale completo** e legenda della stessa versione; calcolare quota superficie consumata con gestioneNoData e copertura; screenshotWMS/ArcGIS per UI. Evitare query live vecchia 2021 quando esiste snapshot 2024.

### CORINE Land Cover — EEA/Copernicus

**✅ REST vector pointquery su entrambi punti, senza chiave.** Base `https://image.discomap.eea.europa.eu/arcgis/rest/services/Corine/CLC2018_WM/MapServer`; layer `0` — `Corine Land Cover 2018 vector`, layer1raster. `0/query` Milano restituisce `{"OBJECTID":766455,"Code_18":"111","Area_Ha":2297.9959852302309,"ID":"EU_766455"}`; Firenze `{"OBJECTID":766288,"Code_18":"111","Area_Ha":1057.3397621700599,"ID":"EU_766288"}`. Classe111 = tessuto urbano continuo. CORS sì, originriflesso. Chiaveno, rate numerico/SLA non documentati. [Documentazione ufficiale CLC](https://land.copernicus.eu/en/products/corine-land-cover?tab=documentation) e [data policy CLMS](https://land.copernicus.eu/en/data-policy): accesso pieno/aperto/gratuito, attribuzione fonte, dichiarazione modifiche, nessun endorsementUE implicito. **Non** inventareCC0/CCBY quando la policy specifica èCopernicus. Anno2018; unità minima cartografica25 ha e ampiezza lineare 100 m, scala di riferimento 1:100000, inadatto a stabilire l'uso legale di una singola particella: usareuso/copertura regionali più fini per contesto, PRG per destinazione urbanistica.

### Ortofoto AGEA/PCN2012

**⚠️ capabilities realmente valide, query GetMap puntuale non riuscita per DNS nella seconda fase.** Base `https://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/raster/ortofoto_colore_12.map` (nome corretto, non inventato `.../WMS/Ortofoto_2012.map`). CapabilitiesWMS 1.3.0 HTTP200, titolo `Ortofoto a colori anno 2012`, abstract specifica acquisizioneAGEA2009–2012, pixel 50 cm. Layeresatti: `OI.ORTOIMMAGINI.2012.32`, `OI.ORTOIMMAGINI.2012.33`, `OI.DATEVOLO.2012`. `Fees`/`AccessConstraints` nellecapabilities: `Nessuna condizione applicata`/`Nessuno`; **non equivalgono a una licenza aperta di redistribuzione o incorporamento nei PDFcommerciali**. Metadati/licenza di riuso ortofoto non accertati; non usare a fini commerciali finché chiariti. CapabilitiesCORS`*`; GetMap su bbox Milano/Firenze, layer fuso 32, tentati con format PNG 256x256: curl000/DNS, nessuna immagine acquisita. Stato della query **non verificato**, non dichiarare successoraster. Download massivo non eseguito in questo audit; non è un divieto accertato del provider. Affidabilità puntuale non accertata, dataset storico; preferire ortofoto regionali attuali con metadati e licenza espliciti.

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://sinacloud.isprambiente.it/arcgisadv/rest/services/Consumo_Suolo/SC_2021_LAEA_v3/ImageServer/identify?f=json&geometry=%7B%22x%22%3A+9.19%2C+%22y%22%3A+45.4642%2C+%22spatialReference%22%3A+%7B%22wkid%22%3A+4326%7D%7D&geometryType=esriGeometryPoint&returnGeometry=false&returnCatalogItems=false'

curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://sinacloud.isprambiente.it/arcgisadv/rest/services/Consumo_Suolo/SC_2021_LAEA_v3/ImageServer/identify?f=json&geometry=%7B%22x%22%3A+11.2558%2C+%22y%22%3A+43.7696%2C+%22spatialReference%22%3A+%7B%22wkid%22%3A+4326%7D%7D&geometryType=esriGeometryPoint&returnGeometry=false&returnCatalogItems=false'

curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://image.discomap.eea.europa.eu/arcgis/rest/services/Corine/CLC2018_WM/MapServer/0/query?f=json&geometry=9.19%2C45.4642&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=%2A&returnGeometry=false'

curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://image.discomap.eea.europa.eu/arcgis/rest/services/Corine/CLC2018_WM/MapServer/0/query?f=json&geometry=11.2558%2C43.7696&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=%2A&returnGeometry=false'

curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/raster/ortofoto_colore_12.map&service=WMS&request=GetCapabilities'

curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://wms.pcn.minambiente.it/ogc?map=%2Fms_ogc%2FWMS_v1.3%2Fraster%2Fortofoto_colore_12.map&service=WMS&version=1.1.1&request=GetMap&layers=OI.ORTOIMMAGINI.2012.32&styles=&format=image%2Fpng&srs=EPSG%3A4326&bbox=9.189%2C45.4632%2C9.190999999999999%2C45.465199999999996&width=256&height=256'

curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://wms.pcn.minambiente.it/ogc?map=%2Fms_ogc%2FWMS_v1.3%2Fraster%2Fortofoto_colore_12.map&service=WMS&version=1.1.1&request=GetMap&layers=OI.ORTOIMMAGINI.2012.32&styles=&format=image%2Fpng&srs=EPSG%3A4326&bbox=11.254800000000001%2C43.7686%2C11.2568%2C43.770599999999995&width=256&height=256'
```


## 15. Basemap vettoriale MapLibre — OpenFreeMap

Base `https://tiles.openfreemap.org/`; style JSON `styles/liberty`, TileJSON `/planet`, MVT `planet/20260927_080001_pt/{z}/{x}/{y}.pbf` dalla risposta TileJSON (non hardcodare versione). StyleLiberty **200**43079byte,111stylelayers; sourceMapLibre esatto `openmaptiles`, typevector,url`https://tiles.openfreemap.org/planet`; sfondo raster `ne2_shaded`. Source-layer vettoriali esatti: `aerodrome_label`,`aeroway`,`boundary`,`building`,`housenumber`,`landcover`,`landuse`,`mountain_peak`,`park`,`place`,`poi`,`transportation`,`transportation_name`,`water`,`water_name`,`waterway`. Il layer `poi` non è inventario ufficiale servizi, `boundary` non sostituisce ISTAT.

Tile puntuale z14 Milano **200MVT**,x8610,y5863,619498byte; Firenze200,x8704,y5972,454040byte (coordinate e tile confermati dai comandi registrati). CORS **sì `*`** su style,TileJSON e entrambi MVT; styleCache-Controlmax-age86400, tileLast-Modified27settembre2026. Nessuna chiave/login, provider dichiara nessun limite richieste/mapviews e **uso commerciale consentito**, nessuno SLA, aggiornamenti planet settimanali. MIT è licenza progetto; dati OSM **ODbL**, schema OpenMapTiles e stili con licenze incluse separate: attribution visibile `©OpenMapTiles Data from OpenStreetMap` anche PDF. Clientdiretto MapLibre; conservare attribution nei report e separare sfondo dall'evidenza. [Quickstart ufficiale](https://openfreemap.org/quick_start/), [FAQ/limiti/attribuzione](https://openfreemap.org/), [licenze incluse](https://github.com/hyperknot/openfreemap/blob/main/LICENSE.md).

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS --max-time 60 -H 'Origin: https://particella.example' -A 'Particella research endpoint-validation' https://tiles.openfreemap.org/styles/liberty

curl -sS --max-time 30 -H 'Origin: https://particella.example' https://tiles.openfreemap.org/planet

curl -sS --max-time 45 -H 'Origin: https://particella.example' https://tiles.openfreemap.org/planet/20260927_080001_pt/14/8610/5863.pbf

curl -sS --max-time 45 -H 'Origin: https://particella.example' https://tiles.openfreemap.org/planet/20260927_080001_pt/14/8704/5972.pbf
```


## 16. Cinque layer aggiuntivi utili in Italia

Proposte differenzianti per il contesto italiano; **non verificato che Sitescope non li abbia**. Nessun feed nazionale APE/Superbonus anonimo completo dimostrato: non basare su questa promessa il prodotto.

### A. Zonizzazione acustica

Toscana, base `https://www502.regione.toscana.it/wmsraster/com.rt.wms.RTmap/wms?map=wmsinqfis`; WMS `rt_inqfis.idpccazon.rt`. Firenze HTTP 200 text/plain `clas_zon='3', codcom='048017', nome='FIRENZE', atto='n.103 del 13/09/2004'`; Milano vuoto/fuori regione. Nessuna chiave, CORS `*`, quota/SLA non pubblicati. [Scheda](https://www502.regione.toscana.it/geoscopio/servizi/wms/INQUINAMENTI_FISICI.htm)/policy Toscana: CC generica, versione dataset da chiarire. **Classe pianificatoria, non rumore misurato**; confrontare atto vigente. `rt_inqfis.quietareas.rt` presente nelle capabilities, non interrogato.

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS --max-time 30 -H 'Origin: https://particella.example' 'https://www502.regione.toscana.it/wmsraster/com.rt.wms.RTmap/wms?map=wmsinqfis&language=ita&service=WMS&version=1.1.1&request=GetFeatureInfo&layers=rt_inqfis.idpccazon.rt&query_layers=rt_inqfis.idpccazon.rt&styles=&srs=EPSG%3A4326&bbox=11.254800000000001%2C43.7686%2C11.2568%2C43.770599999999995&width=101&height=101&x=50&y=50&format=image%2Fpng&info_format=text%2Fplain&feature_count=5'
```

### B. Terreni percorsi da incendio

Toscana, `https://www502.regione.toscana.it/ows_catasto/com.rt.wms.RTmap/ows?map=owsincendi&language=ita`; WMS `rt_incendi_2022.polygon.rt`/serie anni. GetFeatureInfo Milano/Firenze HTTP 200 vuoto; Milano fuori regione. Nessuna chiave, CORS `*`, CC generica da precisare, rate/SLA non trovati. [Scheda](https://www502.regione.toscana.it/geoscopio/servizi/wms/INCENDI.htm). Un anno vuoto non esclude vincoli di catasto incendi o altri atti/periodi.

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS --max-time 30 -H 'Origin: https://particella.example' 'https://www502.regione.toscana.it/ows_catasto/com.rt.wms.RTmap/ows?map=owsincendi&language=ita&service=WMS&version=1.1.1&request=GetFeatureInfo&layers=rt_incendi_2022.polygon.rt&query_layers=rt_incendi_2022.polygon.rt&styles=&srs=EPSG%3A4326&bbox=11.254800000000001%2C43.7686%2C11.2568%2C43.770599999999995&width=101&height=101&x=50&y=50&format=image%2Fpng&info_format=text%2Fplain&feature_count=5'
```

### C. Siti contaminati/bonificati

Lombardia, `https://www.cartografia.servizirl.it/expo/services/gpt/siti_bonificati_contaminati/MapServer/WMSServer`; WMS `Siti_bonificati_e_contaminati10964`. Capabilities/query Milano HTTP 200, query vuota; Firenze fuori copertura. Nessuna chiave, CORS origine riflessa. [Metadato](https://www.geoportale.regione.lombardia.it/en-GB/metadati?_detailSheetMetadata_WAR_gptmetadataportlet_identifier=r_lombar%3Ac5ac536b-88fa-4d44-a700-ff1598c7cf09&_jsfBridgeRedirect=true&p_p_id=detailSheetMetadata_WAR_gptmetadataportlet&p_p_lifecycle=0&p_p_mode=view&p_p_state=normal): **CC BY 4.0**, 31 dicembre 2025, scala 1:10.000, localizzazione puntuale non perimetro contaminazione. Rate/SLA non pubblicati, SIN MASE non tutti inclusi; nessuna certificazione salubrità. Serve screening prossimità/snapshot.

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS --max-time 30 -H 'Origin: https://particella.example' 'https://www.cartografia.servizirl.it/expo/services/gpt/siti_bonificati_contaminati/MapServer/WMSServer?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=Siti_bonificati_e_contaminati10964&query_layers=Siti_bonificati_e_contaminati10964&styles=&srs=EPSG%3A4326&bbox=9.189%2C45.4632%2C9.190999999999999%2C45.465199999999996&width=101&height=101&x=50&y=50&format=image%2Fpng&info_format=application%2Fjson&feature_count=5'
```

### D. Sinkhole/sprofondamenti censiti

ISPRA `https://sinacloud.isprambiente.it/arcgisgeo/rest/services/servizi/sinkhole/MapServer`; REST 0 `Sinkhole_punti`, 1 `Sinkhole con foto`. Query entro 10 km entrambi punti HTTP 200 `features:[]`. Nessuna chiave, CORS origine riflessa, maxRecordCount 3000 (pagina), rate/SLA non pubblicati. Licenza specifica non nel servizio: [note legali ISPRA](https://www.isprambiente.gov.it/it/note-legali) CC BY 4.0 salvo eccezioni, applicabilità da confermare. Inventario fenomeni noti, non probabilità di cedimento; vuoto non significa assenza rischio.

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -sS --max-time 30 -H 'Origin: https://particella.example' 'https://sinacloud.isprambiente.it/arcgisgeo/rest/services/servizi/sinkhole/MapServer/0/query?f=pjson&geometry=9.19%2C45.4642&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=10000&units=esriSRUnit_Meter&outFields=%2A&returnGeometry=false'

curl -sS --max-time 30 -H 'Origin: https://particella.example' 'https://sinacloud.isprambiente.it/arcgisgeo/rest/services/servizi/sinkhole/MapServer/0/query?f=pjson&geometry=11.2558%2C43.7696&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=10000&units=esriSRUnit_Meter&outFields=%2A&returnGeometry=false'
```

### E. Calore superficiale estivo

ISPRA `https://sinacloud.isprambiente.it/arcgisadv/rest/services/Consumo_Suolo/Temperatura_media_diurna_estiva_al_suolo_2017_2022_v2023/ImageServer`; REST identify, banda F32. HTTP 200 Milano `value:"43.2994"`, Firenze `value:"45.5335"`; nessuna chiave, CORS origine riflessa, quota/SLA/licenza raster specifica non documentati nel servizio.

[Rapporto SNPA 2023 fig.194–196](https://www.snpambiente.it/wp-content/uploads/2023/10/Rapporto_consumo_di_suolo_2023.pdf): LST media diurna estiva 2017–2022 Landsat8, °C. **Associazione servizio dal nome coincidente/metodologia: inferenza dichiarata**, REST privo di unità/licenza dirette. Temperatura superficie, **non aria**, comfort indoor o previsione; interessante per verde/ombreggiamento dopo conferma metadati.

Richieste realmente eseguite (rimossi soltanto i percorsi temporanei di output):

```bash
curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://sinacloud.isprambiente.it/arcgisadv/rest/services/Consumo_Suolo/Temperatura_media_diurna_estiva_al_suolo_2017_2022_v2023/ImageServer/identify?f=json&geometry=%7B%22x%22%3A+9.19%2C+%22y%22%3A+45.4642%2C+%22spatialReference%22%3A+%7B%22wkid%22%3A+4326%7D%7D&geometryType=esriGeometryPoint&returnGeometry=false&returnCatalogItems=false'

curl -L --max-time 20 -sS -H 'Origin: https://particella.example' 'https://sinacloud.isprambiente.it/arcgisadv/rest/services/Consumo_Suolo/Temperatura_media_diurna_estiva_al_suolo_2017_2022_v2023/ImageServer/identify?f=json&geometry=%7B%22x%22%3A+11.2558%2C+%22y%22%3A+43.7696%2C+%22spatialReference%22%3A+%7B%22wkid%22%3A+4326%7D%7D&geometryType=esriGeometryPoint&returnGeometry=false&returnCatalogItems=false'
```


## Tabella riassuntiva finale

Chiave “no” vale per la capacità provata; licenza aperta del dato non equivale a hosting illimitato. N/V = non verificato. Per licenza incompleta, stato ⚠️ anche quando query/HTTP riesce.

| Layer | Fonte | Protocollo | Chiave | CORS | Licenza | Stato verifica |
|---|---|---|---|---|---|---|
| 1 Geocoding/reverse | Nominatim OSM | REST JSON | No | Sì | ODbL; hosting 1 req/s/app | ✅ 2 punti + forward; gerarchia Milano anomala |
| 1 Geocoding/reverse | Photon | REST GeoJSON | No | Sì | ODbL dati / Apache 2 software | ✅ 2 punti + forward; lang=it ❌ |
| 1 Indirizzi ufficiali | ANNCSU | REST JSON, CSV ZIP | No | No | CC BY 4.0 | ✅ civici/odonimi 2 città, stradari |
| 2 Catasto identificazione | AdE INSPIRE | WMS GetFeatureInfo | No | No | CC BY 4.0 | ✅ zoning 3 punti, parcel rurale |
| 2 Catasto geometrie | AdE INSPIRE | WFS GML 3.2 | No | No | CC BY 4.0 | ✅ geometrie 3 punti |
| 2 Catasto bulk | AdE | ZIP GML | No | No | CC BY 4.0 | ⚠️ Range ZIP riuscito, import non eseguito |
| 3 Comune/codice ISTAT | ISTAT | ArcGIS REST | No | Sì | CC BY 4.0 generale | ✅ 3 punti Comuni2026 |
| 4 DTM 10 m | INGV TINITALY 1.1 | WMS JSON, WCS TIFF | No | Sì | CC BY 4.0 | ✅ 2 quote/WCS; ⚠️ unità slope |
| 4 Quota 90 m | Open-Meteo | REST JSON | No demo; commerciale a pagamento | Sì | Dati CC BY 4.0 / free hosting non commerciale | ✅ 2 punti; ⚠️ uso commerciale |
| 4 Quota 25 m | OpenTopoData EUDEM | REST JSON | No | No | Copernicus free/open | ✅ 2 punti; demo limitata |
| 4 DSM 30 m | CopDEM mirror AWS | S3/COG HTTPS | No | No | WorldDEM30 specifica | ⚠️ 206 tile 2 punti, quota non estratta |
| 5 PAI/P1/P2/P3/indicatori | ISPRA IdroGEO | WMS JSON | No | No | CC BY-SA 4.0 documento pericolosità | ✅ 2 punti; release live N/V |
| 5 Vettori live | ISPRA IdroGEO | WFS | No | No | Come release pertinente | ❌ WFS disabled in HTTP 200 |
| 6 Classe sismica | DPC maggio 2025 | CSV | No | No | CC BY 4.0 generale DPC | ✅ download/join 2 comuni |
| 6 PGA MPS04 | INGV | WFS/WMS | No | Sì | CC BY 4.0 | ✅ nodi bbox 2 punti, interpolazione non eseguita |
| 7 Natura 2000 | EEA/DG ENV 2024 | ArcGIS REST | No | Sì | CC BY 4.0 release specifica | ✅ 2 punti vuoti + controllo positivo |
| 7 Aree protette nazionali | EEA NatDA/CDDA 2026 | ArcGIS REST | No | Sì | CC BY 4.0 release specifica | ✅ 2 punti vuoti + controllo positivo |
| 7 EUAP/SIC/ZPS legacy | MASE PCN | WMS/WFS candidati | No osservata | N/V | N/V | ⚠️ URL ufficiali, curl DNS fallito |
| 7 Paesaggio art.136 | MiC SITAP | WMS JSON | No | No per Particella | N/V | ⚠️ query 2 punti, licenza/vigenza da chiarire |
| 7 Provvedimenti vincoli | MiC Vincoli in Rete | Web | Login per atti secondo FAQ | Sì su pagina 503; API N/V | N/V | ⚠️ chiusura notturna 20–7, API non provata |
| 8 Servizi vicini | Overpass/OSM | POST QL JSON | No | Sì | ODbL | ✅ 2 punti; hosting pubblico inadatto a carico stabile prodotto |
| 9 Isocrone | Valhalla FOSSGIS | REST GeoJSON | No | Sì | ODbL dati / MIT software | ✅ auto Milano + piedi Firenze; demo |
| 9 Percorsi | OSRM FOSSGIS | REST JSON | No | Sì | ODbL dati / BSD 2 software | ✅ 2 route; ❌ isocrone standard |
| 9 Isocrone con account | openrouteservice | REST POST JSON | Gratuita | Sì preflight | ODbL + TOS piano | ⚠️ anonimo401, autenticato non provato |
| 10 Irraggiamento/PV | JRC PVGIS 5.3 | REST GET JSON/CSV | No | No | JRC gratuito senza restrizioni d'uso | ✅ 2 punti |
| 10 Sole astronomico | SunCalc | Calcolo locale | No | N/A | BSD 2 software | ⚠️ docs, runtime non eseguito |
| 11 Popolazione comune | ISTAT DEMO stima 2026 | CSV ZIP | No | No | CC BY 4.0 generale | ✅ 2 ZIP e totali comunali |
| 11 Griglia popolazione | ISTAT 2021 1 km² | ArcGIS REST | No | Sì | CC BY 4.0 generale | ✅ 3 punti |
| 11 Statistiche SDMX | ISTAT EsploraDati | SDMX REST | No documentata | N/V | CC BY 4.0 generale | ⚠️ dataflow timeout |
| 12 Zone/quotazioni | AdE OMI pubblico | JSON, KML ZIP, HTML | No consultazione | Sì | CC BY 4.0 | ✅ 2 zone/perimetri/prezzi 2025/2; API web fragile |
| 12 Export massivo | AdE OMI area riservata | Download | Login | N/A | CC BY 4.0 | ⚠️ gratuito documentato, login non eseguito |
| 13 PGT sintesi | Lombardia Tavola Previsioni | WMS/ArcGIS REST | No | Sì | N/V dataset | ⚠️ Milano positivo; sintesi non conformativa |
| 13 Stato piani | Toscana Geoscopio | WMS GML | No | Sì | CC generica, versione N/V | ⚠️ Firenze positivo, non zone del lotto |
| 13 PO vigente | Comune Firenze | WMS GML | No | No | CC BY 4.0 | ✅ A1 al punto; ⚠️ GetMap/formati |
| 13 PRG Torino | Comune/Regione Piemonte | WMS text | No | Sì | CC BY 4.0 | ✅ Torino R2/ZUSA3, non mosaico regionale completo |
| 13 PSC | Emilia-Romagna | WMS | No | Sì | CC BY 4.0 | ⚠️ caps, query vuote/incoerenti; non PUG corrente |
| 13 PI/PAT candidato | Veneto IDT2 | WMS/WFS | No caps | Sì | N/V candidati | ⚠️ caps valide; zonizzazione pertinente non provata |
| 13 PRG/PUG candidato | Puglia/SIT Bari | WMS | No link; SPID altre funzioni | N/V | N/V | ⚠️ TLS locale, layer/query non provati |
| 14 Consumo suolo | ISPRA/SNPA | GeoTIFF, ArcGIS ImageServer | No | Sì REST | TXT CC BY, versione incoerente | ⚠️ live RGB/NoData, snapshot non scaricato |
| 14 Copertura suolo | EEA/Copernicus CLC2018 | ArcGIS REST | No | Sì | Policy Copernicus free/open | ✅ 2 punti111, scala non catastale |
| 14 Ortofoto | AGEA/PCN2009–2012 | WMS | No caps | Sì caps; GetMap N/V | N/V riuso | ⚠️ caps valide, GetMap DNS fallito |
| 15 Basemap | OpenFreeMap | Style/TileJSON/MVT | No | Sì | ODbL dati; stili/schema separati | ✅ style+tile 2 punti |
| Extra Acustica | Toscana | WMS text | No | Sì | CC generica, versione N/V | ⚠️ classe3 Firenze, licenza da precisare |
| Extra Incendi | Toscana | WMS text | No | Sì | CC generica, versione N/V | ⚠️ query vuote, copertura/anni limitati |
| Extra Contaminazione | Lombardia | WMS | No | Sì | CC BY 4.0 | ✅ query tecnica vuota, prossimità non calcolata |
| Extra Sinkhole | ISPRA | ArcGIS REST | No | Sì | Applicabilità CC BY generale N/V | ⚠️ query10km vuote |
| Extra Calore superficiale | ISPRA/SNPA | ArcGIS ImageServer REST | No | Sì | N/V specifica raster | ⚠️ valori2 punti, metadati da confermare |
