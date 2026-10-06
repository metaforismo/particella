# Sessione F — evidenza locale

**PASS**, 6 ottobre 2026. Branch `feat/production-readiness`, codice verificato fino a `549a1e5`, base iniziale `cbbaedb` (allineata a `origin/main` all'apertura). Durante la sessione `origin/main` è avanzato a `a058519`, di sei commit: non sono stati integrati in questo branch. Questi esiti non attestano il risultato di un futuro riallineamento.

| Controllo                 | Esito | Evidenza                                                                          |
| ------------------------- | ----- | --------------------------------------------------------------------------------- |
| `npm run lint`            | PASS  | Exit 0                                                                            |
| `npm run typecheck`       | PASS  | Exit 0                                                                            |
| `npm test`                | PASS  | 124 test, zero falliti o saltati; fixture e trasporti finti, nessun test live     |
| `npm run build`           | PASS  | Next.js 16.3.8; tutte le 13 route API, incluso OpenAPI/status; Proxy riconosciuto |
| `npm run format:check`    | PASS  | `src`, `tests`, `scripts`                                                         |
| Prettier documenti/config | PASS  | `docs/ops`, `vercel.ts`, package e lock                                           |
| `git diff --check`        | PASS  | Nessun errore di whitespace                                                       |
| `npm audit --omit=dev`    | PASS  | Zero vulnerabilità nelle dipendenze di produzione; non attesta le dipendenze dev  |

## HTTP sul build di produzione

`npm start -- --hostname 127.0.0.1 --port 3221`, richieste soltanto locali, senza probe alle fonti né costruzioni catastali. Il processo di questa prova è stato arrestato.

| Richiesta                                                 | Esito osservato                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Health                                                    | 200, `no-store`, `Server-Timing`                                                                  |
| Catalogo fonti                                            | 200, `max-age=86400, s-maxage=86400`, `Server-Timing`                                             |
| OpenAPI                                                   | 200, documento 3.1.0, cache un giorno, `Server-Timing`; health senza risposta 429 dichiarata      |
| Catalogo, stesso indirizzo                                | Prime 60 richieste accettate; la 61ª: 429, `ApiError.rate_limited`, `Retry-After: 60`, `no-store` |
| Health dopo esaurimento quota                             | 200                                                                                               |
| POST lotti con corpo vuoto dopo esaurimento quota leggera | 400 di validazione: bucket pesante ancora disponibile                                             |
| Catalogo, altro indirizzo                                 | 200                                                                                               |

I test esercitano anche abbreviazioni catastali nel bucket pesante, tier con chiave hash, contatori Redis atomici condivisi fra due store, degrado in memoria, osservazioni senza polling, probe admin, minimizzazione JSON, lettura/scrittura Blob privata finta e prebuild sequenziale finto.

## Non eseguito

**NOT RUN:** deploy Vercel; prova del Proxy/CDN hosted; Redis reale fra istanze; store Blob reale e cold start; prebuild/upload degli indici ufficiali; probe attivo live; import di estratti OSM. Nessun archivio grande è stato scaricato permanentemente. Rimossa soltanto la cache npm temporanea creata dalla sessione; il build locale rimane nel worktree.

Nessun push o PR. Prima del rilascio: riallineamento con main e controlli sul risultato integrato; scelta e configurazione dei servizi in [PRODUCTION.md](PRODUCTION.md); qualificazione dell'hosting descritto in [HOSTING.md](HOSTING.md); poi prove esterne autorizzate.
