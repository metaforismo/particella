# Roadmap

Ultimo aggiornamento: 6 ottobre 2026. Le priorità derivano da [`business/mercato-e-pricing.md`](business/mercato-e-pricing.md):
il dato grezzo è gratuito, quindi il valore sta nella sintesi verificabile, nella velocità rispetto al CDU e nella
profondità su una nicchia. Prima nicchia: **scouting di terreni per fotovoltaico e agrivoltaico**; canale di volume:
**geometri e architetti**.

## Fatto (beta)

- Studio con mappa, catasto, 13 livelli di analisi reali, quadro sintetico, chat con citazioni, confronto fino a 4 lotti.
- Scheda stampabile con fonti numerate, export del confine GeoJSON/KML, API JSON documentata.
- Pagina fonti generata dal registro, limiti dei dati dichiarati, provenienza su ogni valore.

## Ora — dati per la nicchia rinnovabili (sessione dati in corso)

- Rete elettrica: distanza da linee AT/AAT e cabine.
- Aree percorse dal fuoco (vincolo L. 353/2000), vincolo idrogeologico, capacità d'uso dei suoli.
- Aree idonee FER dove esistono mappe ufficiali; altrimenti criteri oggettivi calcolati e dichiarati come tali.
- Pendenza ed esposizione del lotto, uso del suolo regionale ad alta risoluzione, siti contaminati.

## Prossimo — funzioni che fanno pagare

1. **Ricerca per area**: disegna un'area o scegli un comune e filtra le particelle per superficie, pendenza, vincoli e distanza dalla rete.
2. **Urbanistica strutturata**: più Comuni collegati; indici e destinazioni con l'articolo delle NTA citato dall'assistente.
3. **Scheda professionale**: logo dello studio, note del tecnico, PDF generato lato server e istantanea datata dei dati.
4. **Account e progetti**: salvataggio dei lotti, cartelle per cliente, condivisione con il team.
5. **Monitoraggio**: avviso quando cambia un dato di un lotto salvato (piano, vincoli, rischio).

## Infrastruttura per la produzione

- Geocoder, Overpass e routing su hosting dedicato o contratto (le istanze pubbliche non sono un servizio garantito).
- Istantanee locali (PostGIS o file versionati) delle fonti statiche, per non dipendere dalla disponibilità degli endpoint pubblici.
- Budget e limiti sul modello AI (AI Gateway) e rate limit a livello di piattaforma.
- Parere legale sulle licenze prima di vendere l'API: CC BY-SA di ISPRA, SITAP senza licenza aperta, ODbL di OSM.

## Pricing

Non ancora deciso. Proposta da validare con gli utenti nella ricerca di mercato (§4): piano gratuito di esplorazione,
scheda singola, abbonamento Pro per professionisti, piano Team/Scouting FER, API.
