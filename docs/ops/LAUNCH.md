# Checklist di lancio

Stato al 6 ottobre 2026. Ogni voce indica chi decide o esegue. Niente va in produzione finché le voci marcate
**bloccante** non sono chiuse.

## Decisioni del titolare del progetto

- [ ] **bloccante** Titolare del trattamento e contatto privacy da inserire in `/privacy`.
- [ ] **bloccante** Parere legale sulle licenze per l'uso commerciale (vedi `docs/business/mercato-e-pricing.md` §6):
      CC BY-SA di ISPRA, SITAP senza licenza aperta dichiarata, ODbL di OpenStreetMap, sintesi PGT Lombardia.
- [ ] Nome e dominio definitivi (oggi "Particella"; `NEXT_PUBLIC_SITE_URL` da impostare).
- [ ] Visibilità della repository e fatturazione di GitHub Actions (oggi la CI non parte per il billing).
- [ ] Pricing: proposta in `docs/business/mercato-e-pricing.md` §4, da validare con utenti.

## Infrastruttura (Vercel)

- [ ] Progetto Vercel collegato alla repository, regione `fra1`, Node.js 24.
- [ ] Variabili d'ambiente da `.env.example` (produzione e preview separate).
- [ ] **bloccante** Geocoding, Overpass e routing su istanze dedicate o fornitori a contratto: le istanze pubbliche
      vietano l'uso commerciale intensivo (il codice rifiuta Overpass pubblico in produzione). Opzioni e costi in
      `docs/ops/HOSTING.md`.
- [ ] Cache condivisa (Redis dal Marketplace di Vercel) per limiti d'uso e risposte delle fonti tra istanze.
- [ ] Storage per gli indici catastali (Vercel Blob) e precostruzione dei comuni più richiesti.
- [ ] Chiave AI Gateway e budget di spesa per l'assistente; modello in `PARTICELLA_CHAT_MODEL`.
- [ ] Web Analytics e Speed Insights attivati nel progetto.
- [ ] Dominio, HTTPS, redirect `www`.

## Qualità prima del lancio

- [ ] CI verde: lint, typecheck, test unitari, build, test end-to-end.
- [ ] `npm run test:live` sulle fonti reali dal deploy di anteprima.
- [ ] Prova manuale su telefono reale: Studio, posizione, bottom sheet, scheda in PDF.
- [ ] Lighthouse su landing e Studio (prestazioni, accessibilità).
- [ ] Firewall Vercel: rate limit a livello di piattaforma sulle route `/api/v1`.

## Dopo il lancio

- [ ] Monitoraggio errori e log strutturati (vedi documentazione backend).
- [ ] Pagina di stato delle fonti verificata in produzione.
- [ ] Primi 10 utenti reali dalla nicchia scelta (fotovoltaico / geometri) e raccolta feedback.
