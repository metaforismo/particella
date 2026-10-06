# Changelog

Formato ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.1.0/). Le versioni seguono il versionamento
semantico a partire dalla prima release pubblica.

## [Non rilasciato]

### Aggiunto
- Landing con mappa e lotto reale animato, sezioni prodotto, legenda dei livelli, esempi reali da provare.
- Studio: mappa con catasto, selezione del lotto per punto, indirizzo o posizione dell'utente; 13 livelli con caricamento
  progressivo, riprova per livello, quadro sintetico del terreno, dettaglio con metriche, legenda, metodo e fonti.
- Assistente "Chiedi al terreno" con strumenti che leggono i livelli e citano le fonti (richiede una chiave AI Gateway).
- Confronto fino a quattro lotti, terreni recenti, link condivisibili con il livello aperto.
- Scheda del terreno stampabile in A4 con fonti numerate; export del confine in GeoJSON e KML.
- API `/api/v1`: geocoding, lotto da punto o da ID + punto interno, livelli, report, catalogo, tile proxy.
- Livelli reali: urbanistica (Firenze, Milano), vincoli paesaggistici, uso del suolo, alluvioni, frane, sismica, aree
  protette, terreno, sole, servizi, raggiungibilità, popolazione, valori OMI.
- Pagine Fonti e licenze, API per sviluppatori, immagine di condivisione, sitemap e robots.

### Aggiunto (dati)
- Urbanistica estesa: mosaici regionali di Lombardia e Veneto, Siena, Torino (oltre a Firenze e Milano).
- Rete elettrica ad alta tensione e stazioni, distanze dalle infrastrutture, aree industriali, cave e discariche
  (OpenStreetMap); uso del suolo regionale (UCS Toscana, DUSAF Lombardia); pendenza ed esposizione.
- Gruppo "Energia", quadro sintetico, confronto, intestazione e note del tecnico nella scheda, app installabile.

### Migliorato
- Report a freddo da oltre 20 s a meno di 8 s; i layer richiesti singolarmente possono attendere fonti lente.
- Numeri in formato italiano in tutti i testi; fogli catastali con lettera e formati storici.

### Sicurezza
- Solo URL http(s) nei link di provenienza e tile solo dal proxy interno; attribuzioni escapate.
- Rate limit della chat su indirizzo fornito dalla piattaforma, con tetto globale; corpo delle richieste limitato.
- Header di sicurezza e permessi del browser ristretti.
