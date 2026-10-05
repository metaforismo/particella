# Verifica backend — 6 ottobre 2026

Branch `feat/backend-core`. Nessun push, PR o deploy. I file frontend esclusi dal brief non sono stati modificati.

| Controllo                                 | Esito                                           |
| ----------------------------------------- | ----------------------------------------------- |
| `npm run lint`                            | PASS, zero warning                              |
| `npm run typecheck`                       | PASS                                            |
| `npm test`                                | PASS, 32 test offline                           |
| `npm run build`                           | PASS, nove route API dinamiche, runtime Node.js |
| Prettier / `git diff --check`             | PASS                                            |
| `npm run test:live`                       | FAIL, exit 1: 23 PASS, 1 PARTIAL, 2 FAIL        |
| HTTP su `next start` locale in produzione | PASS per gli stati attesi; report parziale      |

## Prove reali

[`tests/live-results.json`](../../../tests/live-results.json) registra le richieste reali su Milano Duomo e Bagno a Ripoli rurale. Non usa fixture. Il conteggio include health, geocoding, comune, catasto, otto layer per punto e tre tile. L'ultima acquisizione è `2026-10-05T22:31:42.759Z` (6 ottobre, ora italiana).

- Catasto dal punto rurale: PASS, `it:A564:_:60:110`, area geometrica 18665,2045 m².
- Milano Duomo: PASS per il 404 atteso, strada catastale.
- Catasto da ID a cache vuota: FAIL. Il foglio noto restituisce un WFS vuoto con `numberMatched="unknown"`; risposta backend 502 `upstream_unavailable`.
- Quota puntuale Milano: PARTIAL. Senza poligono viene misurato un solo campione, quindi non si stima la pendenza. Terreno rurale con geometria: PASS.
- Overpass Milano: FAIL per indisponibilità entro il tempo assegnato; la stessa query è riuscita in una precedente esecuzione e il punto rurale è PASS nell'ultima. Non costituisce prova di un guasto globale.
- Gli altri layer e i tre PNG WMS: PASS nell'ultima esecuzione. `empty` resta un vuoto della fonte, non una dichiarazione di assenza di rischi.

[`http-results.json`](http-results.json) prova le route della build su `http://127.0.0.1:3314`, con un singolo processo Node.js di produzione e `PARTICELLA_SINGLE_INSTANCE=1`. Health, cataloghi, geocoding, selezione del lotto, lettura da ID **dopo selezione sul medesimo processo**, layer sismico, report e tre tile sono stati validati con zod. Il report restituisce HTTP 200 con sette layer utilizzabili e `services: unavailable`, perché l'istanza Overpass pubblica richiede un override di hosting in produzione. Il server di prova è stato fermato.

## Evidenze e requisiti aperti

Le fixture reali sono ridotte/normalizzate senza inventare valori; `tests/fixtures/manifest.json` conserva URL, timestamp, hash originale e riduzione. `ade-zoning-filter-empty.xml` riproduce il limite del lookup freddo, distinto dalla fixture positiva ottenuta tramite bbox. `ispra-landslide-style.xml` proviene dal GetStyles pubblico ISPRA e conferma `cod_per_it`: 0=AA, 1=P1, 2=P2, 3=P3, 4=P4.

Per ripetere il mapping delle classi:

```bash
curl -sS 'https://idrogeo.isprambiente.it/geoserver/ows?service=WMS&version=1.1.1&request=GetStyles&layers=idrogeo%3Apericolosita_frane'
```

Il requisito di risoluzione generale della particella da ID a cache vuota rimane aperto. Prima di usare istanze Vercel indipendenti serve un lookup ufficiale verificato oppure un indice catastale condiviso. Non è stata introdotta una conversione intuitiva del numero di foglio nel riferimento nazionale.

Prima della produzione configurare hosting e quote globali dei provider: la cache e il limiter attuali sono locali al processo. La popolazione comunale iniziale copre soltanto Milano/Firenze; la griglia 2021 è live. Urbanistica/NTA e gli altri cinque layer del contratto restano per la fase successiva.

Nessun archivio grande o raster nazionale scaricato. La cache npm temporanea è stata eliminata; i temporanei di questa sessione in `/private/tmp` sono stati rimossi. La cache di build Next è eliminabile senza toccare sorgenti, snapshot o fixture.
