# Roadmap

Ultimo aggiornamento: 6 ottobre 2026. Le priorità derivano da [`business/mercato-e-pricing.md`](business/mercato-e-pricing.md):
il dato grezzo è gratuito, quindi il valore sta nella sintesi verificabile, nella velocità rispetto al CDU e nella
profondità su una nicchia. Prima nicchia: **scouting di terreni per fotovoltaico e agrivoltaico**; canale di volume:
**geometri e architetti**.

## Fatto (beta)

- Studio con mappa, catasto, 17 livelli di analisi reali, quadro sintetico, chat con citazioni, confronto fino a 4 lotti.
- Urbanistica in Lombardia, Veneto, Firenze, Siena, Torino, Milano; rete elettrica, infrastrutture, siti industriali.
- Scheda stampabile con fonti numerate, export del confine GeoJSON/KML, API JSON documentata.
- Pagina fonti generata dal registro, limiti dei dati dichiarati, provenienza su ogni valore.

## Ora

- Ricerca per comune, foglio e particella e lotti composti: fatti. Prossimo passo: indici catastali precostruiti
  per i comuni più richiesti, così anche la prima ricerca è immediata.
- Fonti escluse finché licenza o interrogabilità non sono qualificate: aree idonee FER, catasto incendi, vincolo
  idrogeologico, capacità d'uso dei suoli, siti contaminati, urbanistica di Emilia-Romagna, Puglia, Roma.

## Prossimo — funzioni che fanno pagare

1. **Ricerca per area**: disegna un'area o scegli un comune e filtra le particelle per superficie, pendenza, vincoli e distanza dalla rete.
2. **Urbanistica strutturata**: più Comuni collegati; indici e destinazioni con l'articolo delle NTA citato dall'assistente.
3. **Scheda professionale**: logo dello studio, note del tecnico, PDF generato lato server e istantanea datata dei dati.
4. **Account e progetti**: salvataggio dei lotti, cartelle per cliente, condivisione con il team.
6. **Monitoraggio**: avviso quando cambia un dato di un lotto salvato (piano, vincoli, rischio).

## Infrastruttura per la produzione

- Geocoder, Overpass e routing su hosting dedicato o contratto (le istanze pubbliche non sono un servizio garantito).
- Istantanee locali (PostGIS o file versionati) delle fonti statiche, per non dipendere dalla disponibilità degli endpoint pubblici.
- Budget e limiti sul modello AI (AI Gateway) e rate limit a livello di piattaforma.
- Parere legale sulle licenze prima di vendere l'API: CC BY-SA di ISPRA, SITAP senza licenza aperta, ODbL di OSM.

## Pricing

Non ancora deciso. Proposta da validare con gli utenti nella ricerca di mercato (§4): piano gratuito di esplorazione,
scheda singola, abbonamento Pro per professionisti, piano Team/Scouting FER, API.
