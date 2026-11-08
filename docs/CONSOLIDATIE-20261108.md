# Koersplein – consolidatie naar één uitvoerketen (8 november 2026)

Status: **ontwerp en gecontroleerde inventarisatie; geen productiewijziging**.

## Vastgestelde situatie
- `main` is de standaardbranch en bevat `.github/workflows/amsterdam-candidates-scheduler.yml` (werkdagen 19:15 UTC; schrijft naar `amsterdam-clean-20261031`) en `amsterdam-staging-schedule.yml` (alleen handmatig; schrijft naar `amsterdam-reset-20261027` en mogelijk testbranch).
- `scripts/history.mjs` + `scripts/history/engine.mjs` verwerken lokale `data/history`-bestanden en gebruiken `data/history-instruments.json` en de Amsterdam-catalogus.
- `scripts/cloudflare/factory-runner.mjs` verwerkt jobs via `FactoryApiClient` en partitie-opslag; `scripts/cloudflare/universal-market-runner.mjs` heeft een eigen marktbrede route met brongoedkeuringsgate.
- `scripts/factory/scheduler.mjs` kan bij `KOERSPLEIN_SCHEDULER_ENABLED=true` een dagelijkse XAMS-job starten; de werkelijke Render-omgevingsvariabele is nog niet gecontroleerd.
- De verschillende routes bewijzen **niet** dat ze gelijktijdig actief zijn. Render, Cloudflare-worker, jobruns en consumenten zijn nog te verifiëren.

## Doelarchitectuur
1. Eén *geautoriseerde writer* per markt/dataset, met een expliciet ownership-register.
2. Eén gedeelde provider- en datavalidatiebibliotheek; geen afzonderlijke importlogica met afwijkende semantiek.
3. Backfill en dagelijkse updates via dezelfde engine met verschillende tijdvensters.
4. Catalogusidentiteit (ISIN/MIC/ticker), bronherkomst, handelskalender, OHLC-integriteit, idempotentie en append-only-bescherming behouden.
5. Research/backtests alleen lezen van gevalideerde data; publiceren uitsluitend na controles.
6. Test/staging/productie afzonderlijke credentials, opslag en deploy-branches.

## Blokkerende verificaties vóór het wijzigen van bestaande routes
- Render service-inventaris: branch, build/startcommando, cronjobs, environment.
- Cloudflare-worker: live routes, bindings, cron triggers, D1/R2 opslag.
- GitHub Actions: actuele runs, dispatches, eventuele externe triggers.
- Volledige import-/aanroepgrafiek: scripts, API's, UI-consumenten en tests.
- Gegevensvergelijking van Amsterdam en Brussel; voorspellingen/backtests en historische dekking.
- Een volledig geslaagde end-to-end dry-run in geïsoleerde testomgeving.

## Beslissingstabel (nog niet verwijderen)
| Onderdeel | Actie | Reden |
|---|---|---|
| `scripts/history/engine.mjs` | kandidaat kernmodule | bestaande lokale geschiedenis en OHLC-validatie |
| `scripts/history/provider-registry.mjs` | behouden en toetsen | reeds gedeelde providerlaag |
| `scripts/cloudflare/factory-runner.mjs` | consolideren na runtimecontrole | API-writer naast lokale history-writer |
| `scripts/cloudflare/universal-market-runner.mjs` | consolideren na runtimecontrole | tweede cloud-importpad |
| `scripts/factory/scheduler.mjs` | uitschakelkandidaat na Render-controle | potentieel extra XAMS-trigger |
| `amsterdam-candidates-scheduler.yml` | behouden totdat vervanger bewezen werkt | enige vastgestelde automatische main-workflow |
| `amsterdam-staging-schedule.yml` | beoordelen na runtimecontrole | handmatige test- en stagingroute |

**Geen automatische verwijderingen, productie-aanpassingen of wijziging van jobs.** Dit document is de controlelijst voor de nieuwe geïsoleerde consolidatiebranch.
