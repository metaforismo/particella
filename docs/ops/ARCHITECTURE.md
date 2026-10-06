# Sessione F: scelte delle interfacce

Uso: `enforceApiLimit(request, CounterStore)` nel proxy; `HttpClient.request` registra una sola osservazione per operazione reale condivisa; `sourceStatuses()` legge le osservazioni; `municipalIndex` legge `CadastralStorage.get(Belfiore)` prima di costruire un archivio. Le route mantengono i payload esistenti, con `SourceStatus` e due endpoint aggiunti.

Sono state confrontate due forme: estendere la cache generica con contatori, stato e file; oppure tenere le tre responsabilità dietro interfacce distinte. È scelta la seconda. I contatori richiedono atomicità, le osservazioni una lista limitata e gli indici fino a 16 MiB, oltre il budget di una singola voce Redis della cache. Redis REST è l'unico trasporto condiviso; `CounterStore.consume` usa un'operazione Lua atomica, `ObservationStore.record/read` una lista di 20 elementi, `CadastralStorage.get/put` JSON privati o disco. Nessun endpoint pubblico espone lo storage o le chiavi.

La memoria dei contatori è per istanza; il fallback Redis è dichiarato nei log. Le osservazioni condivise durano 24 ore, la mediana copre gli ultimi 15 minuti. Cache hit e coalescenza non diventano controlli nuovi. Lo storage Blob configurato non ricade sul disco durante un guasto: ciò eviterebbe falsamente la persistenza e avvierebbe download ripetuti su istanze nuove. Un indice assente o non valido può essere ricostruito; un guasto di storage si propaga.

I limiti di esecuzione rimangono nei segmenti Next, consumati dal build output di Vercel; `vercel.ts` configura regione, Fluid Compute e cache. Niente cron. Il prebuild è un comando operativo esplicito, non un hook di build/deploy.
