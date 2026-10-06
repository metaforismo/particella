# Cache condivisa opzionale

Default: `MemoryCache`, LRU bounded, limite `PARTICELLA_CACHE_MAX_BYTES` (64 MiB), nessuna dipendenza o servizio obbligatorio.

Per condividere cache HTTP, particelle e risultati fra istanze, configurare entrambe:

```dotenv
PARTICELLA_CACHE_REDIS_REST_URL=https://<endpoint-redis-rest>
PARTICELLA_CACHE_REDIS_REST_TOKEN=<secret>
```

`RedisRestCache` usa l'API comandi Redis via POST JSON (compatibile con Upstash REST): GET, SET con PX e DEL per invalidazione. Endpoint HTTPS, redirect vietati, budget 250 ms per operazione. Chiavi SHA-256 con namespace `particella:v1`; valori serializzati V8 con scadenza assoluta e TTL Redis. La serializzazione conserva `Uint8Array` delle risposte HTTP. I risultati geospaziali non vengono convertiti in stringhe o numeri stimati. Il namespace dei risultati layer è versionato quando cambiano i provider.

`FallbackCache` legge prima la memoria e scrive sempre localmente. Errori di rete, permessi e payload corrotti aprono un circuito di 30 s: la cache remota non può rendere indisponibile un provider. Le due variabili mancanti o una configurazione non valida lasciano attiva la memoria. Nessun token viene registrato nei log. Conservare il token solo nell'ambiente server.

TTL preesistenti: HTTP secondo fonte/opzioni; risultati layer completi 24 ore; risultati unavailable/error/partial 30 s. La cache remota non promuove un risultato letto in memoria con un TTL nuovo. Valori oltre 3 MB non vengono salvati su Redis, conservando il fallback locale. Una scadenza è controllata anche dopo la lettura remota.

**Limiti:** adapter verificato offline con API mock e payload binari; nessuna istanza Redis reale configurata in questa sessione. Serializzazione V8 richiede runtime Node compatibili; un cambio incompatibile o un dato corrotto produce cache miss tramite fallback. Il limiter dei provider rimane per processo: Redis qui condivide dati, **non** quote o slot di rete. Servono hosting/provider dedicati o limiti distribuiti prima dell'uso commerciale multi-istanza dei servizi pubblici. Durante un outage, un'invalidazione remota può fallire e i dati remoti precedenti restano fino al TTL; la memoria locale viene comunque invalidata.
