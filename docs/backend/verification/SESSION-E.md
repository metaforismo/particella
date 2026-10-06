# Sessione E — verifica locale del 6 ottobre 2026

- PASS: `npm run lint`, `npm run typecheck`, `npm test` (106/106), `npm run build`, `npm run format:check`, `git diff --check`.
- PASS: `npm run test:live -- --cadastral`, sei ricerche in sei regioni, apertura spaziale dei risultati, due componenti aggiuntivi, POST lotto e GET URL composto.
- PASS HTTP reale: server di produzione locale sulla porta 3211; geocode Firenze e Bagno a Ripoli, POST lotto, GET URL composto, distinzione Comune catastale/amministrativo di Alassio. Tutte HTTP 200; server fermato dopo la verifica. Artefatto `session-e-http.json`.
- Layer del lotto: 17 verificati live; 15 risposte ok/empty/outside_coverage, 2 partial (OMI: valori residenziali di zona e prevalenza non dichiarata; rete OSM: dati/tensioni incompleti). Non sono fallimenti dell'unione né una certificazione di completezza delle fonti. Risultati completi in `session-e-live.json`.
- NOT RUN: suite live storica completa senza `--cadastral`; pubblicazione, PR, CI ospitata e deploy.
- Snapshot ISTAT: 7.896 righe dal CSV legacy ufficiale, più vecchio del conteggio SITUAS corrente. Catasto semestrale per localizzazione, geometria finale WFS live; nessun 404 dedotto da un vuoto WFS non confermato.
- Commit funzionali BLOCKED: `git add` / `git commit` rifiutati con `Operation not permitted` su `.git/worktrees/Particella-backend/index.lock`. Modifiche preservate nel worktree. Solo il commit di formato `381fa9f` è riuscito prima del blocco.
- Base iniziale verificata: `ed57b0b`, allora main remoto. Durante la sessione origin/main è avanzato a `9eca314` con due commit solo documentali (README/changelog/roadmap); nessun rebase con il lavoro non committato.

Le misure di archivio, download parziale e indicizzazione sono in `docs/research/cadastral-*-measurements.json`. I file ZIP provinciali/comunali, cache di prova e script temporanei sono stati eliminati; restano fixture piccole, snapshot, documentazione e log della verifica.
