<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Lavorare in questo repository

Particella è un'app Next.js 16 (App Router) con frontend e backend nello stesso progetto.

## Next.js 16

La versione installata ha breaking changes rispetto a quella che potresti conoscere (es. `params` e
`searchParams` sono Promise, tipi globali `PageProps`, `LayoutProps`, `RouteContext`). Prima di scrivere
pagine o route handler leggi le guide in `node_modules/next/dist/docs/01-app/`.

## Mappa del codice

- `src/lib/contracts/` — contratto zod condiviso tra UI e API. Si cambia qui per primo, poi i due lati.
- `src/app/(site)/` — pagine pubbliche; `src/app/studio/` — lo Studio; `src/app/scheda/` — la scheda stampabile.
- `src/app/api/v1/` — route handler pubbliche.
- `src/server/` — backend: `core/` agnostico dal paese, `countries/<codice>/` adapter nazionali.
- `src/components/` — UI; `src/styles/tokens.css` — design token (vedi `docs/DESIGN.md`).

## Regole

- Nessun colore scritto a mano nei componenti: usa o aggiungi un token.
- Ogni valore mostrato deve avere una `Provenance`. Non confondere dato mancante, vuoto e fuori copertura.
- Gli URL che arrivano da fonti esterne finiscono in un `href` solo se http/https; i tile passano solo dal
  nostro proxy `/api/v1/tiles/`.
- Test offline con fixture in `tests/fixtures/`; i test che toccano la rete vanno in `npm run test:live`.
- Prima di aprire una PR: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Conventional Commits (`feat(studio): …`, `fix(server): …`, `docs: …`), un branch per argomento, PR verso `main`.
