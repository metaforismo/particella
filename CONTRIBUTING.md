# Contribuire a Particella

## Flusso di lavoro

1. Parti da `main` aggiornato e crea un branch per argomento: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
2. Commit piccoli in stile [Conventional Commits](https://www.conventionalcommits.org/it/): `feat(studio): …`,
   `fix(server): …`, `test: …`, `docs: …`. Il corpo del messaggio spiega il perché.
3. Prima di aprire la PR:
   ```bash
   npm run lint && npm run typecheck && npm test && npm run build
   ```
4. Apri la PR verso `main` descrivendo cosa cambia, come l'hai verificato e cosa resta fuori.
5. Si fa merge solo con CI verde.

## Aggiungere un livello di analisi

1. Aggiungi l'id a `LayerId` in `src/lib/contracts` e la descrizione in `src/content/layers.ts` (titolo,
   domanda, simbolo di legenda).
2. Registra la fonte in `src/server/countries/<paese>/sources.ts` con licenza, copertura e stato di verifica.
3. Scrivi il provider in `src/server/countries/<paese>/layers/` restituendo un `LayerResult` completo:
   `headline` comprensibile a chi non è tecnico, `scope` corretto, `provenance` per ogni valore.
4. Registra una fixture reale ridotta in `tests/fixtures/` e scrivi i test offline, compresi i casi vuoto,
   fuori copertura e fonte non raggiungibile.

## Aggiungere un paese

Crea `src/server/countries/<codice>/` implementando `CountryAdapter` e registralo in
`src/server/countries/index.ts`. Il core (`src/server/core`, `src/server/geo`) non va toccato.

## Stile

- Codice e nomi in inglese, testi dell'interfaccia in italiano.
- Commenti solo dove spiegano un perché non ovvio.
- UI: segui `docs/DESIGN.md`; nessun colore fuori dai token.
