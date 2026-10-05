# Design system — "il rilievo"

Particella prende il linguaggio visivo dalle carte topografiche e dalle planimetrie catastali, non dai
cruscotti SaaS. Chi la usa deve sentirsi davanti a un foglio di rilievo ordinato, dove ogni segno ha un
significato e una fonte.

## Principi

1. **Il lotto è l'unico elemento che grida.** Il giallo cantiere (`--cantiere`) con tratteggio a 45° marca il
   terreno analizzato e nient'altro: non lo si usa per bottoni, link o decorazioni.
2. **La fonte sta accanto al dato.** Ogni valore mostrato ha ente, licenza e data di lettura raggiungibili in
   un clic (Studio) o come nota numerata (Scheda).
3. **Un dato mancante non è un dato rassicurante.** `empty`, `outside_coverage` e `unavailable` hanno etichette
   e colori diversi; nessun riepilogo li somma a "nessun rischio".
4. **Il colore non porta da solo il significato.** Ogni stato ha anche un'etichetta testuale; la gerarchia
   regge in scala di grigi.
5. **Un solo momento di movimento per pagina.** In home è il volo sul lotto con la scheda che si compila; nello
   Studio è il caricamento progressivo dei layer. Il resto è fermo. `prefers-reduced-motion` è rispettato.

## Colori

I token vivono in `src/styles/tokens.css`. Nessun componente scrive colori a mano: se manca, si aggiunge un token.

| Ruolo | Token | Uso |
|---|---|---|
| Carta | `--paper`, `--paper-sunk`, `--paper-raised` | fondo, superfici incassate, pannelli |
| Inchiostro | `--ink`, `--ink-2`, `--ink-3` | testo principale, secondario, didascalie |
| Righe | `--rule`, `--rule-strong` | separatori, bordi dei controlli |
| Seppia | `--sepia`, `--sepia-soft` | curve di livello, citazioni, note |
| Idrografia | `--hydro`, `--hydro-soft` | acqua, rischio idraulico, focus |
| Vegetazione | `--verde`, `--verde-soft` | aree protette, uso del suolo |
| Lotto | `--cantiere`, `--hatch` | solo il terreno selezionato |
| Severità | `--sev-{none,low,medium,high,unknown}` (+`-bg`) | stato dei layer, sempre con etichetta |

## Tipografia

Una sola famiglia, **Archivo** variabile, ospitata in `src/fonts/` (licenza OFL). L'asse di larghezza è parte
del linguaggio:

- `--stretch-wide` (118%) per titoli e marchio;
- `--stretch-normal` per il testo;
- `--stretch-condensed` (78%) per identificativi catastali, valori e fonti nelle tabelle.

Scala in `tokens.css` (`--fs-2xs` … `--fs-display`). Numeri in colonna con la classe `.num` (cifre tabulari).

## Forma

Il raggio cresce con la dimensione dell'oggetto: `--radius-xs` per etichette, `--radius-sm` per controlli,
`--radius-md` per schede, `--radius-lg` per pannelli flottanti sulla mappa. Le ombre (`--lift`,
`--lift-strong`) servono solo a ciò che galleggia sopra la mappa.

## Mappa

- Basemap OpenFreeMap Positron ricolorata in `src/lib/map/basemap.ts`, etichette in italiano.
- Catasto dell'Agenzia delle Entrate come raster dal nostro proxy `/api/v1/tiles/cadastre/…`, visibile da zoom 15.
- Lotto: tratteggio giallo + alone chiaro + contorno inchiostro (`src/lib/map/plot-layer.ts`).
- Colori per classe dei layer in `src/lib/map/layer-style.ts`; le classi sconosciute ricadono sul tono del layer.

## Scrittura

Italiano semplice, frasi attive, nessun gergo quando esiste una parola comune. I pulsanti dicono cosa
succede ("Apri la scheda", "Copia link"). Gli errori spiegano cosa è successo e cosa fare, senza scusarsi.
Mai promettere che "si può costruire": si descrive cosa dicono le fonti e cosa resta da verificare.
