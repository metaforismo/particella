# Preparazione Vercel — sessione F

Codice destinato a Node.js, Fluid Compute, regione europea `fra1`, istanze multiple senza disco persistente. Nessuna pubblicazione, creazione di servizi, probe live o upload Blob è parte di questa sessione. [Configurazione TypeScript Vercel](https://vercel.com/docs/project-configuration/vercel-ts), [regioni](https://vercel.com/docs/functions/configuring-functions/region).

## Configurazione prima del lancio

Usare `.env.example` come inventario. Per avviare il progetto non servono segreti. Per il servizio completo impostare `NEXT_PUBLIC_SITE_URL`, `NOMINATIM_URL`, `PHOTON_URL` (fallback), `OVERPASS_URL`, `VALHALLA_URL` verso servizi propri/contrattualizzati. Gli endpoint devono implementare i protocolli dei rispettivi adapter: cambiare dominio non trasforma Geoapify, Pelias o ORS in Nominatim/Valhalla. Niente chiavi nella query degli endpoint: finiranno nella provenance della risposta; autenticare tramite un gateway privato del servizio. Vedi [HOSTING.md](HOSTING.md) per costi e compatibilità.

Per quote globali servono entrambe `PARTICELLA_CACHE_REDIS_REST_URL` e `PARTICELLA_CACHE_REDIS_REST_TOKEN`, idealmente in UE vicino a Frankfurt. Configurare un Blob **privato**, scegliere la regione UE separatamente dal runtime e collegare `BLOB_READ_WRITE_TOKEN`. Il backend usa esclusivamente letture/scritture autenticate `access: private`; il token di uno store pubblico non viene silenziosamente accettato come storage pubblico. Senza token si usa il disco locale temporaneo. [Storage Blob privato](https://vercel.com/docs/vercel-blob/private-storage).

`vercel.ts` imposta `fra1`, Fluid Compute, cache tile/catalogo e 300 secondi per geocode, lotti, particelle/analisi e scheda. Le stesse durate sono esportate dai segmenti Next. Le altre route hanno 60 secondi; chat e status 120. Niente cron. Memoria delle funzioni Fluid si sceglie nel dashboard, in base al picco della costruzione catastale (provincia decompressa limitata a 512 MiB, ZIP comunale a 64 MiB); il prebuild evita che la prima visita debba costruire questi indici. Il massimo di 300 secondi rientra nei limiti Fluid documentati; non garantisce che una fonte risponda entro tale durata. [Durate Vercel](https://vercel.com/docs/functions/configuring-functions/duration).

Gli header restituiti dalla funzione prevalgono sulla configurazione di cache della stessa route: gli errori mantengono `no-store`. Il CDN non deve conservare un 429 individuale come risposta del catalogo/tile. La verifica hosted deve confermare anche questo comportamento del Proxy. [Precedenza e criteri di cache Vercel](https://vercel.com/docs/caching/cdn-cache).

## API e limiti

`GET /api/v1/openapi.json`: OpenAPI 3.1 generata con `z.toJSONSchema`, cache pubblica un giorno. Descrive ogni metodo/route, query e path, corpi JSON, risposte, `ApiError`, `Retry-After`, `Server-Timing`, PNG e stream SSE. I controlli semantici di Zod (es. catastale, ultimo messaggio utente, x/y nella griglia) restano eseguiti sul server; JSON Schema ne documenta i limiti strutturali.

`src/proxy.ts` limita tutte le richieste `/api/v1/*` prima degli handler, esclusa health. Identità: `x-real-ip`, altrimenti ultimo hop non vuoto di `x-forwarded-for`, mai il primo. Il reverse proxy su hosting alternativo deve eliminare gli header client e impostare questi valori. Si conservano solo digest negli identificativi dei contatori, mai indirizzi nei log.

| Bucket per indirizzo | Senza chiave / minuto | Chiave valida / minuto | Route                                                                          |
| -------------------- | --------------------: | ---------------------: | ------------------------------------------------------------------------------ |
| Leggero              |                    60 |                    600 | geocode testuale, cataloghi, OpenAPI, status passivo                           |
| Pesante              |                   120 |                  1.200 | layer/report, particelle, lotti, chat, probe, geocode con intento catastale    |
| Tile                 |                 1.500 |                  6.000 | tile della mappa (una schermata ne carica decine, lo spostamento molte di più) |

Finestra fissa di 60 secondi dal primo consumo. I cataloghi condividono la stessa quota; pesante, leggero e tile sono indipendenti. Il rilevamento di geocode catastale nel proxy è una classificazione di costo, mentre l'handler verifica la sintassi completa. Una chiave pubblica cambia il tier dello stesso indirizzo: ruotare chiave nello stesso tier non azzera il bucket. Questo prepara il piano a pagamento; non implementa fatturazione, quote per cliente o autenticazione obbligatoria. Il limite chat esistente (8 messaggi/minuto, 120 globali per istanza) resta aggiuntivo.

Redis usa `EVAL` atomico con incremento/scadenza, non `get/set`. Senza Redis il limite è **per istanza**; istanze nuove hanno bucket nuovi. Un guasto Redis ricade in memoria per 30 secondi, log `rate_limit_memory_fallback`: la quota globale non è una garanzia durante il guasto. Non impiegare questo limite come tetto di spesa assoluto.

`PARTICELLA_API_KEYS`: lista di hash SHA-256 hex separati da virgola, vuota = feature disattivata. Generare chiavi casuali ad alta entropia fuori dal repository, dare al client la chiave originale tramite un canale riservato, configurare solo il digest. Il client invia `Authorization: Bearer <chiave>`. Hash malformati sono errori di configurazione; bearer sconosciuti restano anonimi. Per revocare rimuovere l'hash e aggiornare l'ambiente. Usare una chiave distinta per `PARTICELLA_ADMIN_KEY_SHA256`.

## Prebuild e persistenza catastale

Con token Blob già configurato nella shell autorizzata:

```sh
npm run cadastre:prebuild -- D612 F205 A794 E648 L219 I726
```

Senza argomenti prepara Firenze, Milano, Bergamo, Lodi, Torino e Siena: capoluoghi con adapter e campioni della sessione D. Lombardia/Veneto sono mosaici regionali: non si presume che tutti i capoluoghi abbiano zonizzazione positiva; ulteriori Belfiore possono essere indicati esplicitamente. Lodi ha un campione vuoto, che non certifica assenza di disciplina.

Il comando valida tutti i codici, deduplica e costruisce **in sequenza** un indice nuovo dalle richieste Range all'archivio ufficiale; conserva solo JSON, mai lo ZIP regionale/provinciale. Ogni file ha massimo 16 MiB; limite di 256 MiB sul fallback disco. `get/put` selezionano Blob se configurato, altrimenti disco. Durata utile di sette giorni dall'upload/mtime, versione nel pathname `cadastral-index/v1/<Belfiore>.json`. Riprogrammare manualmente il prebuild prima della scadenza o dopo aggiornamenti: nessun cron attivo. Gli overwrite possono avere una finestra di propagazione; le letture usano l'origine con `useCache:false`. [Caching Blob](https://vercel.com/docs/vercel-blob).

Su un'istanza nuova l'indice prebuilt evita l'archivio; il servizio deve ancora verificare la particella tramite AdE. “Prima ricerca immediata” significa assenza del costo di costruzione, non zero chiamate esterne o una latenza garantita. Indice mancante/scaduto/non valido: tentativo di ricostruzione con i limiti già presenti. Guasto Blob configurato: errore, senza nascondere il guasto dietro il disco e nuovi download. Coalescenza e ammissione di build restano per istanza: prebuild dei Comuni di lancio e monitoraggio sono necessari.

## Stato e log

`GET /api/v1/status`, cache 15 secondi: una voce `SourceStatus` con `Provenance` per ogni fonte del registro. Nessun polling. Ultimo esito reale `ok`, `slow` (operazione >= 3.000 ms), `error`; mai interrogata = `unknown`, timestamp e mediana null. Fino a 20 osservazioni, mediana negli ultimi 15 minuti, ultimo controllo conservato 24 ore. L'età è esplicita in `checkedAt`: un controllo vecchio non attesta disponibilità corrente. Durata include attese limiter e retry. Stato descrive trasporto/protocollo HTTP verificato da HttpClient, non vigenza, completezza o correttezza semantica del dataset. Snapshot non interrogati non acquisiscono un falso `ok`.

Redis conserva liste limitate con operazioni atomiche. Lo scope della singola voce è `shared` o `instance`; letture Redis fallite usano osservazioni locali. I cache hit e le richieste coalescenti non aggiornano il controllo. Anche i download archivio AdE diretti sono osservati.

`?probe=1` richiede un bearer corrispondente a `PARTICELLA_ADMIN_KEY_SHA256`: non configurato = 503, chiave assente/errata = 401. Una richiesta attiva globale al minuto (per istanza senza Redis), risposta no-store. Una HEAD per fonte, nessun download, deadline 2 secondi ciascuna, massimo quattro host in parallelo e un solo controllo alla volta per host. Endpoint che rifiutano HEAD/redirect segnalano errore del probe anche se una query dati GET funzionerebbe: è un controllo opzionale del trasporto, non un test di disponibilità dei dataset. Disabilitato se env vuota.

Log JSON a riga singola: `event=request|source|operational`, route come template, fonte, host, durata, esito, stato HTTP per richiesta, cache `hit|miss|mixed|none`. Gli ID catastali, IP, query/URL completi, corpi e chiavi sono esclusi; nessuna coordinata viene registrata (quindi non si conservano neppure coordinate esatte in produzione). Errori upstream non vengono serializzati. Una linea richiesta alla risposta; per chat è il tempo ai header, non la durata completa del flusso. Una linea fonte per operazione HTTP, retry aggregati; i cache hit sono distinti. Le chiamate condivise hanno il contesto della prima richiesta. Richieste servite interamente dal CDN non producono una nuova esecuzione dell'handler.

Su Vercel: progetto → **Logs**, ambiente Production/Preview e finestra temporale; cercare `"event":"source"`, `"outcome":"error"`, `rate_limit_memory_fallback` o uno `source` specifico, poi filtrare path/stato e aprire il RequestId della piattaforma. La piattaforma raggruppa stdout per richiesta. Per retention/esportazione scegliere un Log Drain e controllare anche i campi HTTP che Vercel aggiunge: la minimizzazione del logger applicativo non modifica i log della piattaforma. [Runtime Logs](https://vercel.com/docs/logs/runtime).

## Verifica e gate esterni

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run format:check`. I test offline coprono inventario di tutte le route, esempi zod/JSON Schema, Redis finto/concorrenza, chiavi/tier, unknown/mediana/cache hit, probe autorizzato, redazione log, Blob privato finto/limiti/scadenza, lettura da istanza nuova e prebuild senza rete. La configurazione effettiva è verificata importando `config` e usando `validateStaticFields`: la CLI di @vercel/config 0.10.0 ha un riepilogo che tratta `config` come campo annidato, perciò il suo solo messaggio “valid” non prova le opzioni.

Esiti della sessione e limiti delle prove: [VERIFICATION.md](VERIFICATION.md).

Prima di pubblicare restano scelte/account: piano Vercel compatibile con attività commerciale; dominio; contratti hosting OSM e attribuzioni; Redis UE; Blob privato UE; Comuni da prebuildare; chiavi admin/API eventuali; budget/credenziali AI. Successivamente serve uno smoke su ambiente Vercel autorizzato, inclusi Proxy, CDN, TTL, Redis reale e cold start Blob. Questi controlli hosted non sono provati dal build locale. Il prebuild reale e i probe live non sono stati eseguiti nella sessione F.
