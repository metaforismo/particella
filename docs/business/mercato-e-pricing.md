# Particella: mercato, concorrenza e pricing

**Ricerca del 6 ottobre 2026.** Fonti web consultate in questa data; i prezzi esteri sono riportati nella valuta originale e IVA come indicata dalla fonte. Convenzione usata in tutto il documento:

- **[F]** = fatto verificato su fonte citata
- **[S]** = stima o inferenza nostra a partire da fatti
- **[P]** = proposta, da validare con utenti

Le conversioni in euro sono indicative (cambi approssimati) e servono solo per confrontare gli ordini di grandezza.

---

## 0. Sintesi per decidere

1. **Il dato grezzo non vale più niente, quindi si vende l'interpretazione.** Dal 1° gennaio 2025 le visure catastali online sono gratuite anche per immobili non propri, mentre allo sportello costano 3 €. La cartografia catastale vettoriale è CC BY 4.0. Particella deve far pagare la sintesi: incrocio, provenienza, PDF pronto per il cliente, AI con citazioni. [F]
2. **In Italia esiste già un concorrente diretto, UrbisMap.** Offre urbanistica, vincoli e catasto su scala nazionale, un piano Freemium, un Premium per i tecnici e un'API a 250 € + IVA per 1.000 richieste al mese. È il benchmark di prezzo e di posizionamento. [F]
3. **Il prodotto sostituito è il CDU, e il CDU è lento.** Costa 32 € di bollo più diritti di segreteria da 20 a oltre 150 € secondo il comune, e il comune ha fino a 30 giorni per rilasciarlo. Una scheda istantanea a 15–29 € regge il confronto, purché si dica chiaramente che non lo sostituisce. [F]/[P]
4. **Primo mercato raccomandato: lo scouting di terreni per fotovoltaico e agrivoltaico.** Ha la disponibilità a pagare più alta, un bisogno immediato (le nuove leggi regionali sulle aree idonee del 2026) e i layer che Particella ha già (vincoli, pendenza, sole, Natura 2000). I geometri restano il canale di volume, con piani freemium e pay-per-report. [S]
5. **Il rischio maggiore è legale.** I dati ISPRA IdroGEO sono CC BY-SA 4.0 (share-alike), le ortofoto AGEA non sono usabili a fini commerciali, SITAP non ha una licenza aperta e i server pubblici OSM vietano l'uso intensivo. Va sistemato prima di vendere l'API. [F]

---

## 1. Concorrenti e sostituti

### 1.1 Italia

| Attore | Cosa fa | Utenti | Prezzo pubblico | Rispetto a Particella |
|---|---|---|---|---|
| **UrbisMap** (Sardegna) | WebGIS con piani urbanistici (PUC/PRG), norme, vincoli (paesaggio, PAI, fasce di rispetto) e catasto su tutta Italia; servizi per la PA (CDU semplificato, digitalizzazione dei piani); API REST con 15 endpoint | Geometri, architetti, ingegneri, agenti, PropTech, comuni | **API: 1.000 richieste/mese 250 € + IVA; 2.500 richieste 450 € + IVA; −10% con impegno di 6 mesi.** Freemium gratuito; il prezzo del Premium non è pubblicato (risulta solo una promozione del −30% nei seminari CFP) [F] ([urbismap.it](https://www.urbismap.it/), [API](https://www.urbismap.it/news/api-per-software-immobiliare-dati-urbanistici/)) | **Il concorrente più diretto.** Punti forti: contenuti urbanistici e NTA, rapporto con i comuni, formazione con crediti. Punti deboli osservabili: niente AI con citazioni, niente isocrone, sole, OMI o demografia in un'unica scheda, UX da GIS tecnico |
| **Geoweb S.p.A.** (società del Consiglio Nazionale Geometri) | Accesso a Sister (visure, ispezioni ipotecarie, Pregeo/Docfa), fatturazione, PCT, formazione | Geometri, ingegneri (protocollo con la Fondazione CNI) | **BASIC senza canone, fatturazione a consumo a soglie di 70 €; PREMIUM 96 € + IVA/anno** (pensato per oltre 190 operazioni catastali l'anno) [F] ([CNG](https://www.cng.it/documents/20142/120151/Geoweb_Geocentro.pdf)) | Non è un concorrente ma il **canale** per i geometri e l'àncora di prezzo: i geometri sono abituati a pagare circa 100 €/anno per l'infrastruttura |
| **Agenzia Entrate: Visura/Geoportale catastale/GEOPOI OMI** | Visure, mappe, quotazioni OMI, tutto gratis online | Tutti | Visura online gratuita dal 2025, 3 € allo sportello [F] ([guida AE nov. 2025](https://www.dirittobancario.it/wp-content/uploads/2025/11/Guida-Agenzia-delle-Entrate-novembre-2025-la-visura-catastale.pdf)) | Il sostituto "fai da te". Serve SPID e richiede 5–10 portali diversi. Particella ne è l'aggregatore |
| **Geoportali regionali e comunali, IdroGEO, SITAP, Vincoli in Rete** | Consultazione settoriale | Tecnici | Gratis | Frammentati, senza report e senza alcun valore certificativo (SITAP lo dichiara espressamente) |
| **Comune: CDU** | Certificato con valore legale | Chi compra, vende o divide terreni (obbligatorio negli atti) | 32 € di bollo + diritti 20–150 € e oltre; fino a 30 giorni [F] (vedi §3) | Sostituto lento ma **insostituibile per legge**. Particella è il pre-screening che viene prima |
| **Immobiliare.it Insights** | Big data immobiliari, piattaforme Realitycs/Insights Enterprise, API, advisory | Banche, investitori, periti, agenti | Non pubblico [F] ([immobiliare.it/insights](https://www.immobiliare.it/insights/)) | Forte sui valori residenziali, debole sul terreno e sui vincoli. È un possibile partner o acquirente dell'API |
| **idealista/data** | Studi di mercato, valutazione di portafogli, dati per IT, ES e PT | Professionisti, istituzionali | Non pubblico [F] | Come sopra |
| **CRIF RES, Nomisma, Tecnoborsa** | Perizie industriali per banche (CRIF: oltre 100.000 valutazioni l'anno, dato 2018), valutazioni | Banche | Su contratto | Clienti possibili dell'API (screening dei rischi sul collaterale), non concorrenti sul prodotto |
| **RealAdvisor Pro** | Report di valutazione per agenti in circa 4 minuti | Agenti | Non pubblico | Sposta la soglia di aspettativa: "report in minuti" |
| **Studi di due diligence** (es. duedili.it) | Servizio professionale con software di AI | Investitori, sviluppatori | Su preventivo | Sono clienti potenziali (white-label), non concorrenti |
| **Inicio** (FR, in espansione in Italia) | Origination di terreni per fotovoltaico e agrivoltaico con un algoritmo proprio; round da 4 M€ ad aprile 2025 | Sviluppatori FER | Modello servizio/commissione [F] ([Vestbee](https://www.vestbee.com/insights/articles/french-inicio-raises-4-m)) | Concorrente nella nicchia FER, con un modello diverso (vende il terreno, non lo strumento) |
| **Glint Solar** (NO) | Prospecting e layout per fotovoltaico e accumuli, contenuti dedicati all'Italia; sta assumendo un Account Executive per l'Italia | Sviluppatori FER | Su demo [F] ([glintsolar.com](https://www.glintsolar.com/pricing)) | Il concorrente più serio nella nicchia FER: ha dati di rete e layout, ma non ha urbanistica comunale né catasto italiano in profondità |

### 1.2 Europa e resto del mondo (benchmark di prezzo)

| Prodotto | Paese | Offerta | Prezzo pubblico (osservato il 6/10/2026) |
|---|---|---|---|
| **Sitescope** | PL | Reports, API (in sviluppo), Studio con AI | **Non pubblico**, solo demo [F] ([sitescope.ai](https://sitescope.ai/)) |
| **OnGeo.pl** "Raport o terenie" | PL | Report PDF di una particella: piano locale, catasto, reti, vincoli, rischi, sole, prezzi medi | **18,45 / 104,55 / 202,95 PLN** (base, standard, completo); completo scontato a 159,90 PLN (circa 4–48 €) [F] ([blog OnGeo](https://blog.ongeo.pl/srednie-ceny-dzialek)) |
| **LandTech LandInsight** | UK | Sourcing, proprietà, pianificazione, AI | **Pro 150 £/mese + IVA** (500 lookup di proprietà); Unlimited su richiesta. Nel 2025 c'erano Starter a 60 £ e Pro a 180 £ IVA inclusa [F] ([land.tech/pricing](https://land.tech/pricing)) |
| **Searchland** | UK | Sourcing, titoli, pianificazione, MCP per l'AI | **Standard 195 £/mese** con pagamento annuale; minimo 12 mesi; da 2.340 £/anno per 1 utente a 1.968 £ con 4 o più utenti, IVA esclusa [F] ([pricing](https://searchland.co.uk/pricing), [G-Cloud 2026](https://assets.applytosupply.digitalmarketplace.service.gov.uk/g-cloud-15/documents/724986/339565102552699-pricing-document-2026-01-27-1302.pdf)) |
| **Nimbus Maps** | UK | Sourcing, reti energetiche nel piano Enterprise | Solo su richiesta [F] |
| **Archistar** | AU | AI per la fattibilità e il 3D | Free / **95 / 345 / 595 $ al mese** (presumibilmente AUD) [F] ([PricingSaaS](https://pricingsaas.com/companies/archistar)) |
| **Zoneomics** | USA e altri | Zonizzazione, brief, AI "Bassett", API | **Essentials 92 $/mese** (25 ricerche, 1 brief); **Advanced 279 $/mese** (150 ricerche, 5 brief); brief aggiuntivo 55–65 $; API a scaglioni con piano gratuito [F] ([zoneomics](https://zoneomics.com/pricing/subscription)) |
| **Gridics** | USA | Zonizzazione 3D, prodotti per comuni | Non pubblico |
| **PriceHubble** | CH, DE, AT, FR… | AVM e API per banche | Non pubblico; valutazione automatica non documentata per l'Italia [F] |
| Prospecting FV (annuncio di vendita su Acquire) | UE | Mappa per land scout fotovoltaico: zonizzazione, particelle, linee di rete, aree protette | **124–149 €/utente/mese** [F] ([Acquire](https://app.acquire.com/startup/ouTfDauIHybGHcvq0wbSRHr2mWu2/7aVI7mOCQcvmQGXj4l0p)) |

**Lettura [S].** Gli abbonamenti per professionisti nel Regno Unito, in Australia e negli Stati Uniti stanno tra **90 e 200 €/mese per utente**. Il modello per singolo report (OnGeo) si colloca tra **5 e 50 €**. Sitescope, il nostro modello di riferimento, non pubblica prezzi: in genere significa vendita B2B su contratto.

---

## 2. Chi paga e perché (Italia)

| Segmento | Dimensione | Perché paga | Disponibilità a pagare [S] |
|---|---|---|---|
| **Sviluppatori FER e i loro consulenti** (scouting fotovoltaico a terra e agrivoltaico) | 5,6 GW di nuovo fotovoltaico nel 2025, di cui **3,4 GW utility-scale (≥1 MW)**; oltre **152 GW** di richieste di connessione fotovoltaica a maggio 2025; bando agrivoltaico PNRR con **540 progetti per 1.548 MW** [F] ([QualEnergia](https://www.qualenergia.it/articoli/dati-2025-fotovoltaico-italia-solare/), [QualEnergia/Terna](https://www.qualenergia.it/pro/articoli-pro/rinnovabili-ready-to-build-sale-8-57-gw/), [lavoripubblici](https://www.lavoripubblici.it/news/stampa/34557)) | Devono scartare in fretta migliaia di particelle. La L. 4/2026 (conversione del DL 175/2025) ridefinisce le aree idonee e chiede alle regioni nuove leggi entro 120 giorni [F] ([lentepubblica](https://lentepubblica.it/buone-pratiche/aree-idonee-per-lagrivoltaico-cosa-cambia-per-i-comuni-dal-2026/)) | **Alta**: 150–500 €/mese per postazione, contratti da 5 a 50 k€/anno |
| **Geometri** | **73.280** iscritti alla Cassa, reddito medio **40.605 €** [F] ([ANSA, ott. 2025](https://www.ansa.it/sito/notizie/economia/pmi/2025/10/23/cassa-geometri-73.280-iscritti-reddito-medio-a-40.605-euro_22a9d368-a3c7-418d-ab11-c0563d75fcdd.html)) | Preventivi, pre-verifiche di edificabilità, successioni, frazionamenti; un PDF da allegare al preventivo | Bassa per utente (àncora Geoweb: 96 €/anno), ma è il volume più grande |
| **Architetti e ingegneri** | Albi 2024: **160.423 architetti e 253.394 ingegneri**; iscritti Inarcassa 174.225; reddito medio degli architetti 37.837 € [F] ([Ingenio](https://www.ingenio-web.it/articoli/inarcassa-2025-conti-record-redditi-pensioni-giovani-iscritti/)) | Fattibilità e concorsi; per gli ingegneri anche impianti FER | Media: 20–50 €/mese |
| **Agenti immobiliari** | **53.124 abilitati** (2023, +2,6%) [F] ([Avvenire](https://www.avvenire.it/economia/lavoro/agenti-immobiliari-in-crescita_75691)); oltre 38.000 imprese di intermediazione [F] ([Wikicasa](https://www.wikicasa.it/news/?p=26460)) | Vendere terreni e rustici con una scheda credibile; acquisire incarichi | Media-bassa; meglio raggiungerli tramite portali e franchising |
| **Banche, periti, servicer** | **906.691 immobili ipotecati** nel 2025, 138,6 mld€ erogati [F] ([lavoripubblici/Rapporto OMI](https://www.lavoripubblici.it/news/mutui-ipotecari-2025-rapporto-omi-38557)); linee guida ABI 5ª ed. e CRR3 dal 2025 | Screening dei rischi fisici (alluvione, frana, sismica) sul collaterale, ESG | Alta ma con un ciclo di vendita di 9–18 mesi; si vende tramite CRIF o i periti |
| **Notai** | circa **5.000** [F] (ISTAT) | Controlli pre-rogito sui terreni (il CDU è obbligatorio) | Bassa come singoli; interessante solo come canale verso i clienti |
| **Privati, eredi, acquirenti di terreni** | Circa 37.000 ettari di terreni compravenduti a trimestre (II trim. 2025) [F] ([OMI/lavoripubblici](https://www.lavoripubblici.it/news/compravendite-immobiliari-dati-omi-terzo-trimestre-2025-36972)) | "Cosa posso fare su questo terreno?" prima di comprare o vendere | Pagamento una tantum per report (10–30 €); il costo di acquisizione è il problema |
| **Comuni (7.896)** | | SUE, pubblicazione dei piani, CDU | UrbisMap è già presente; ciclo di vendita pubblico (MePA). **Non è un mercato iniziale** [S] |

---

## 3. Segnali di disponibilità a pagare

| Voce | Costo / tempo | Fonte |
|---|---|---|
| Visura catastale online (anche per immobili non propri) | **Gratis dal 1/1/2025**; allo sportello 3 € | [F] [Guida AE nov. 2025](https://www.dirittobancario.it/wp-content/uploads/2025/11/Guida-Agenzia-delle-Entrate-novembre-2025-la-visura-catastale.pdf) (alcune guide private citano ancora 0,90–1,35 €: sono superate) |
| Visura tramite Poste | 6 € online, 11 € allo sportello | [F] [informazionefiscale](https://www.informazionefiscale.it/visura-catastale-online-sito-agenzia-delle-entrate-istruzioni-costi) |
| CDU: bollo | 2 × 16 € = **32 €** | [F] [Studio Madera](https://www.studiomadera.it/news/150-certificato-destinazione-urbanistica) |
| CDU: diritti di segreteria | Rivarolo C.se 20–40 €; Frosinone 30–60 €; Ferrara 60 €; Firenze circa 103 €; Anguillara Sabazia **150 €** (fino a 5 particelle) + 10 € per ogni particella in più | [F] [Rivarolo](https://www.rivarolocanavese.it/it-it/download/tariffe-anno-2024-165842-9-1112-ebcc79f309890edb1949637d1c8144bb), [Anguillara](https://www.comune.anguillara-sabazia.roma.it/wp-content/uploads/Tabella-dei-costi-di-accesso-agli-atti-1.pdf), [Ferrara](https://servizife.comune.ferrara.it/8892/attach/intedilizia/docs/tabella_delibera_diritti_segreteria.pdf), [Frosinone](https://comune.frosinone.it/wp-content/uploads/2025/05/delibera_diritti_segreteria_2014.pdf) |
| CDU: tempi | Fino a **30 giorni**; validità 1 anno | [F] Studio Madera |
| Perizia del geometra | Stima 300–800 € (appartamento); perizia per mutuo 400–700 € | [F] [BusinessOnline](https://www.businessonline.it/articoli/quanto-costa-una-perizia-tecnica-di-un-geometra-giurata-e-non-sul-valore-di-una-casa-prezzi-medi.html) |
| Studio di pre-fattibilità di un lotto | **Nessun listino pubblico affidabile**. Stima: 300–1.500 € secondo la complessità, spesso assorbiti nell'incarico | [S] da verificare con 10 interviste |
| SaaS per professionisti in Italia | Geoweb Premium 96 €/anno; ACCA PriMus, rinnovo annuale 979 € | [F] [CNG](https://www.cng.it/documents/20142/120151/Geoweb_Geocentro.pdf), [UniCT capitolato ACCA](https://www.unict.it/sites/default/files/ac_altri_documenti/specifiche_fornitura_acca_software_signed_1.pdf) |

**Implicazione [S].** Oggi il cliente spende **50–180 € e aspetta fino a 30 giorni** solo per il CDU, senza contare il tempo del tecnico che incrocia a mano PAI, vincoli e sismica. Particella non può sostituire il CDU, che resta obbligatorio negli atti di trasferimento dei terreni. Può però:

- evitare un CDU inutile su un terreno da scartare;
- far risparmiare 1–3 ore di ricerca a ogni pre-verifica (pari a 40–120 € al costo orario di un tecnico).

---

## 4. Proposta di pricing [P]

Principi:

- **La consultazione resta gratuita** (UrbisMap ha il Freemium, e il dato pubblico è gratis).
- Si paga per **output utilizzabile**: PDF senza watermark e col logo dello studio, export, volume, API.
- I prezzi italiani stanno **al 30–50% dei benchmark anglosassoni**, coerentemente con i redditi medi (circa 38–41 k€ per architetti e geometri).

| Piano | Prezzo [P] | A chi | Cosa include | Cosa resta escluso |
|---|---|---|---|---|
| **Esplora** | 0 € | Privati, studenti, prova | Studio completo in consultazione; 3 schede PDF al mese con watermark; 10 domande AI al mese; fonti visibili | Export, logo, storico, confronto |
| **Scheda singola** | **19 € + IVA**; pacchetto da 10 a **149 €** (validità 12 mesi) | Privati, eredi, agenti occasionali | PDF completo senza watermark, link condivisibile, 20 domande AI sulla particella | |
| **Pro** | **39 €/mese** oppure **390 €/anno** + IVA (lancio per i primi 500: **290 €/anno**) | Geometri, architetti, agenti | Schede illimitate (fair use 150/mese); logo e intestazione dello studio; AI 300 messaggi/mese; progetti e storico con data del dato; export GeoJSON/KML/DXF; confronto fra 3 lotti; selezione multi-particella | Scouting per area, API |
| **Team / Scouting FER** | **149 €/mese per utente** (minimo 2 utenti, annuale) | Sviluppatori FER, società di ingegneria, investitori | Tutto il Pro, più: **ricerca per area con filtri** (superficie, pendenza, vincoli assenti, aree idonee, distanza dalla rete AT); liste esportabili di particelle; workspace condivisi; alert; report white-label; 1.000 chiamate API/mese | |
| **API / Enterprise** | Da **250 €/mese** per 1.000 richieste (allineato a UrbisMap), **0,15–0,25 €** a richiesta oltre la soglia; contratti enterprise **10–60 k€/anno** | Portali, PropTech, banche/CRIF, assicurazioni | Endpoint JSON con provenienza, SLA sui dati in snapshot, onboarding dedicato, eventuale licenza white-label | |

Perché questi numeri [S]:

- **19 €** sta sotto il solo bollo del CDU (32 €) e nella fascia del report standard o completo di OnGeo (circa 25–48 €).
- **39 €/mese** costa meno della metà di Zoneomics Essentials (92 $) e Archistar Basic (95), ed è vicino alla soglia di acquisto d'impulso di un libero professionista.
- **149 €/utente** coincide con il prezzo osservato per il prospecting fotovoltaico (124–149 €) ed è sotto LandInsight Pro (150 £) e Searchland (195 £).

Da validare: test A/B fra 29 e 39 € sul Pro e fra 99 e 149 € sullo Scouting.

---

## 5. Go-to-market

### 5.1 Primo mercato: scouting di terreni per FER [S, argomentato]

Perché questo e non i geometri:

1. **Valore per decisione molto alto.** Un impianto da 10 MW vale milioni; scartare prima un terreno vincolato vale molto più di 149 €/mese.
2. **Urgenza normativa.** Le leggi regionali sulle aree idonee del 2026 cambiano la mappa e oggi nessuno la offre già pronta a livello di particella.
3. **Particella copre già circa il 70% dello screening.** Ha vincoli, Natura 2000, PAI, pendenza e terreno, sole, catasto e accessibilità. Mancano aree idonee, rete elettrica e ricerca per area.
4. **Pochi clienti, facili da raggiungere.** Alcune centinaia di sviluppatori e land scout, concentrati in Puglia, Sicilia, Sardegna, Basilicata e Lazio.
5. **I concorrenti hanno un buco.** Glint Solar e Inicio sono esteri e deboli sul catasto e sull'urbanistica comunale.

**I geometri restano il secondo mercato**: con Esplora + Scheda + Pro generano volume, notorietà e dati d'uso. Sono il canale più lento da monetizzare (àncora a 96 €/anno, UrbisMap già presente).

### 5.2 Canali

| Canale | Segmento | Azione |
|---|---|---|
| Italia Solare, Elettricità Futura; fiere **Key Energy** (Rimini) e **Intersolar Europe** | FER | Demo dal vivo "screening di 100 particelle in 10 minuti"; webinar sulle aree idonee regione per regione |
| Land scout freelance e società di sviluppo | FER | Programma referral; prova gratuita di 14 giorni sul piano Scouting |
| **Collegi geometri, CNGeGL, Geoweb** | Geometri | Seminari con CFP (UrbisMap lo fa già); integrazione o convenzione Geoweb, sul modello della partnership Geoweb–GruppoPiù del gennaio 2026 [F] ([comunicato](https://www.geoweb.it/GeowebHtml/servizi/pdf/2026_01_19_CS_Partnership_Geoweb.pdf)) |
| Ordini di architetti e ingegneri | Tecnici | Convenzioni con sconto, formazione |
| Portali (sezione terreni di Immobiliare.it e idealista), aste giudiziarie | Agenti, privati | Scheda incorporata come widget o API; rev-share |
| CRIF RES, periti, assicurazioni | Banche | Pilota API sullo screening dei rischi fisici dei portafogli |
| SEO programmatico ("vincoli particella foglio X comune Y") | Privati | Pagine per comune con anteprima gratuita |

### 5.3 Le 5 funzioni che più probabilmente fanno pagare [S]

1. **Ricerca per area e selezione multi-particella con filtri**: superficie minima, pendenza, assenza di vincoli, distanza dalla rete. È la funzione che separa uno strumento di scouting da un visualizzatore.
2. **Layer aree idonee FER per regione + infrastruttura elettrica** (linee AT e cabine primarie da OSM, con riferimenti a Terna Econnextion), con verifica dei requisiti agrivoltaici.
3. **Urbanistica comunale strutturata**: zona di PRG/PGT, indici ed estratto delle NTA con l'articolo citato dall'AI. La copertura va estesa per priorità (capoluoghi, poi comuni del Sud ad alta densità di progetti FER). Si aggiunge la pre-compilazione della richiesta di CDU.
4. **Report col marchio dello studio, export e prova della data**: logo, DXF/KML/SHP, snapshot "dati al giorno X" con hash. Serve come diligenza documentata verso il cliente.
5. **Alert e monitoraggio di portafogli** (nuova release PAI, varianti, nuovo semestre OMI) via email e API batch: è la base dei contratti ricorrenti con banche e sviluppatori.

---

## 6. Rischi

### 6.1 Licenze dei dati (uso commerciale)

| Dato | Licenza / condizioni | Rischio | Mitigazione |
|---|---|---|---|
| Cartografia catastale (WMS/WFS, download massivo) | **CC BY 4.0** [F] ([lavoripubblici](https://www.lavoripubblici.it/news/stampa/35094)) | Basso | Attribuzione in ogni scheda e risposta API |
| Visure (intestatari) | Gratis tramite SPID, per la singola persona | **Alto** se automatizzate o rivendute (dati personali, GDPR) | Non estrarre automaticamente i dati; rimandare l'utente al servizio dell'AE |
| OMI | Forniture **CC BY 4.0** con attribuzione "Agenzia delle Entrate – OMI" (verifica interna in `docs/research/data-sources.md`); i download massivi richiedono il login. Fonti più vecchie dubitavano dell'uso commerciale [F] ([ondata](https://github.com/ondata/quotazioni-immobiliari-agenzia-entrate)) | Medio: gli endpoint GEOPOI non sono un'API contrattuale | Snapshot semestrali dalle forniture ufficiali, non scraping dal vivo |
| ISPRA IdroGEO (pericolosità frane e alluvioni, IFFI) | **CC BY-SA 4.0**: i dati derivati vanno rilasciati con la stessa licenza [F] ([licenza ISPRA pericolosità](https://idrogeo.isprambiente.it/cms/wp-content/uploads/2022/03/Licenza_Condizioni_Uso_Pericolosita_Indicatori_Rischio_ISPRA.pdf), [IFFI](https://idrogeo.isprambiente.it/cms/wp-content/uploads/2020/05/Licenza_Condizioni_Uso_Inventario_IFFI_ISPRA_Regione_Valle_Aosta.pdf)); il resto del sito ISPRA è CC BY 4.0 [F] ([note legali](https://www.isprambiente.gov.it/it/note-legali)) | **Medio-alto per l'API**: i campi derivati (es. "% della particella in P3") potrebbero dover essere CC BY-SA, quindi senza esclusiva per i clienti enterprise | Tenere gli attributi ISPRA in un layer separato e dichiarato CC BY-SA; parere legale prima dei contratti enterprise |
| Geoportale Nazionale (MASE) | **CC BY-SA 3.0 IT** tranne le ortofoto [F] ([GEOmedia](https://mediageo.it/ojs/index.php/GEOmedia/article/download/1365/1247/5846)) | Medio (share-alike) | Come sopra |
| Ortofoto AGEA | **Uso commerciale non consentito** [F] ([Prov. Sondrio](https://provinciasondrio.it/sites/default/files/contents/modulistica_procedimenti/3015/condizioni-utilizzo.pdf)) | Alto | Immagini da provider commerciali oppure ortofoto regionali con licenza aperta verificata |
| SITAP / Vincoli in Rete (MiC) | Nessuna licenza aperta accertata; non certificativi; Vincoli in Rete è chiuso dalle 20 alle 7 [F] (verifica interna) | Medio | Mostrare come "indicazione ricognitiva" con link; chiedere l'autorizzazione al MiC |
| OpenStreetMap | **ODbL**: attribuzione; share-alike sui database derivati usati pubblicamente; i "produced works" (mappe, PDF) richiedono solo l'attribuzione [F] ([osm.org/copyright](https://www.openstreetmap.org/copyright)) | Medio per l'API (un database derivato venduto va rilasciato in ODbL) | Separare i dati OSM; self-hosting di Nominatim, Overpass e Valhalla (le policy dei server pubblici vietano l'uso commerciale intensivo) |
| Open-Meteo e simili | Hosting gratuito solo per uso non commerciale [F] (verifica interna) | Basso | Piano a pagamento o dati nazionali (TINITALY) |

### 6.2 Responsabilità

- **Il CDU resta l'unico documento con valore legale** sulla destinazione urbanistica. Ogni scheda deve dichiarare in modo evidente: natura orientativa, data e fonte di ogni valore, "non sostituisce CDU né parere di tecnico abilitato" (oggi è già nel README).
- Verso i privati (B2C) le clausole di esonero sono limitate dal Codice del Consumo; verso i professionisti serve un tetto di responsabilità contrattuale (per esempio, pari al canone pagato) [S]. Valutare un'assicurazione di RC professionale o tech E&O.
- **AI Act**: obblighi di trasparenza per i chatbot (dire che si parla con un'AI). Va inoltre evitato che l'AI "inventi" norme: risposte vincolate alle fonti raccolte, come già previsto.
- La pericolosità ISPRA ha scala regionale o nazionale: ISPRA stessa chiede studi specifici a scala catastale. Una percentuale "in P3" non va presentata come perizia.

### 6.3 Dipendenza da endpoint pubblici

- Non ci sono SLA e ci sono limiti di frequenza (ISTAT SDMX: 5 query al minuto; Nominatim: 1 al secondo), finestre di chiusura e cambi di schema senza preavviso [F] (verifica interna).
- **Mitigazione [P]:** snapshot in PostGIS per i dataset statici (PAI, Natura 2000, OMI, sismica), con il live solo come controllo. SLA enterprise solo sui dati in snapshot. Monitor con test live notturni (`npm run test:live`).

### 6.4 Rischi di mercato

- **Abbassamento delle barriere**: con catasto e visure gratuiti, chiunque può costruire un aggregatore. Il vantaggio difendibile sta in tre cose: urbanistica strutturata per comune, qualità della provenienza, workflow (alert, team, export).
- **UrbisMap** potrebbe aggiungere l'AI. **Immobiliare.it Insights** potrebbe aggiungere un layer terreni.
- **Glint Solar** sta assumendo in Italia: la finestra nella nicchia FER è stimata in 12–18 mesi [S].

---

## 7. Incertezze e prossimi passi

- **Da verificare con il primo contatto commerciale:** prezzo del Premium di UrbisMap e sua copertura reale dei PRG; prezzo di Sitescope (chiedere una demo); costo reale di una pre-fattibilità (10 interviste a geometri).
- **Esperimenti [P]:**
  - 20 interviste a sviluppatori FER e land scout;
  - landing con pre-ordine del piano Scouting a 149 €;
  - pilota con un collegio geometri provinciale;
  - parere legale su CC BY-SA e ODbL applicati all'API.
