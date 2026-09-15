# Koersplein-datafabriek

## Architectuur

De browser gebruikt dezelfde historie-URL's als voorheen. Op een serverdeployment worden `manifest.json` en `<ISIN>.json` dynamisch uit de datastore geleverd. Een provider schrijft alleen via de job-engine naar opslag; Git, pull requests en deploys zijn geen onderdeel van een koersupdate.

1. **Frontend** — bestaande statische Koersplein-site en grafiekcontracten.
2. **Backend** — `scripts/factory/server.mjs`, publieke historie-API en beveiligd beheer.
3. **Datastore** — SQLite in `KOERSPLEIN_DATA_DIR` (standaard `var/`).
4. **Providers** — vervangbare adapters via `ProviderRegistry` met gecontroleerde fallback.
5. **Jobs** — batches, items, pogingen, checkpoint, voortgang en fout per instrument.
6. **Scheduler** — optionele marktgerichte trigger, standaard uit.

De migratie in `scripts/factory/migrations/001_initial.sql` maakt reproduceerbaar tabellen voor `markets`, `instruments`, `daily_prices`, `history_status`, `jobs`, `job_items` en `scheduler_runs`.

## Datastore en golden import

```bash
KOERSPLEIN_DATA_DIR=var npm run datastore:init
KOERSPLEIN_DATA_DIR=var KOERSPLEIN_HISTORY_SOURCE_DIR=data/history npm run datastore:import-golden
KOERSPLEIN_DATA_DIR=var npm run factory:status
```

De primaire sleutel `(instrument_id, trading_date)` maakt import idempotent. ASML en Adyen kunnen dus opnieuw worden aangeboden zonder duplicaten. Provider, importtijd en provider-metadata blijven per koersdag bewaard.

## Jobs

- `HISTORY_BACKFILL`: selecteert alleen ontbrekende of mislukte historie en probeert maximaal beschikbare historie.
- `DAILY_UPDATE`: begint op de dag na de laatst opgeslagen handelsdag.
- `REPAIR_MISSING`: herstart alleen instrumenten met foutstatus.
- `VALIDATE_HISTORY`: controleert opgeslagen datums en OHLC zonder providerrequest.
- `CHECK_AMSTERDAM`: actualiseert de beheerstatus van alle Amsterdamse instrumenten.

Elke job heeft afzonderlijke items. Een fout zet alleen dat item op `FAILED`; de volgende instrumenten gaan door. Na een procesherstart worden `RUNNING` items teruggezet naar `PENDING` en vervolgt de job. Batchgrootte is configureerbaar met `KOERSPLEIN_JOB_BATCH_SIZE`.

Een CLI-job starten kan met:

```bash
KOERSPLEIN_DATA_DIR=var npm run factory:job -- VALIDATE_HISTORY
```

Een volledige backfill hoort pas bewust vanuit `/beheer` te worden gestart nadat provider/licentie en persistente productieopslag akkoord zijn. De bouw/test initialiseert zo'n job niet.

## Providers toevoegen

Implementeer een adapter met `id`, `supports(instrument)` en `fetchDaily(instrument, range)`, en registreer hem in `createDefaultProviderRegistry`. De adapter retourneert genormaliseerde bars met datum, OHLC, volume en adjusted close. Instrumentidentiteit komt uit de Euronext-catalogus (ISIN, MIC en ticker); een adapter moet zijn eigen symbool, beurs en valuta controleren.

Yahoo is uitsluitend de huidige technische testadapter. Een volgende gratis of officieel delayed bron kan vóór of na deze adapter in de registry worden geplaatst zonder database- of frontendwijziging.

## Scheduler

De ingebouwde scheduler staat standaard uit. Met `KOERSPLEIN_SCHEDULER_ENABLED=true` controleert een blijvend draaiende server ieder kwartier of op werkdagen rond `KOERSPLEIN_SCHEDULER_UTC_HOUR` een Amsterdamse `DAILY_UPDATE` nodig is. `scheduler_runs` voorkomt een dubbele job per datum.

Een externe goedkope scheduler kan ook een beveiligde POST naar `/internal/schedule/daily` sturen met `Authorization: Bearer <KOERSPLEIN_SCHEDULER_SECRET>`. Er is geen GitHub Action per aandeel en geen deploy nodig.

Let op: een gratis Render Web Service slaapt en is daarom geen betrouwbare interne klok. Een Render Cron Job kost minimaal geld. Geen van beide is in dit bouwblok geactiveerd.

## Beheer en beveiliging

`/beheer` vereist alle drie servervariabelen:

- `KOERSPLEIN_ADMIN_USERNAME`
- `KOERSPLEIN_ADMIN_PASSWORD`
- `KOERSPLEIN_SESSION_SECRET` (minimaal 32 willekeurige tekens)

Zonder deze variabelen blijft beheer met status 503 dicht. Na inloggen gebruikt de server een ondertekende HttpOnly/SameSite-sessioncookie. Mutaties zijn POST-only en vereisen zowel dezelfde origin als het CSRF-token uit de sessie. Er staat geen beheerwachtwoord of sessiesleutel in browsercode. Na vijf mislukte pogingen volgt tijdelijk een blokkade.

De pagina toont totalen, dekking, jobvoortgang en per instrument naam, ticker, ISIN, index, status, records, eerste/laatste datum, provider, laatste controle en fout.

## Render-grens en eenmalige instelling

De huidige `koersplein-test` is een gratis Static Site. Die kan geen Node-server of persistente SQLite uitvoeren. Zonder een betaalde dienst te activeren is de datafabriek daarom lokaal/deployment-ready, maar `/beheer` nog niet publiek operationeel.

Na expliciet akkoord is de minimale duurzame Render-configuratie:

1. maak één Web Service vanuit dezelfde repository en branch, met auto-deploy uit;
2. build command: `npm test && npm run history:test`;
3. start command: `npm run backend`;
4. koppel een persistent disk aan `/opt/render/project/src/var`;
5. stel `KOERSPLEIN_DATA_DIR=/opt/render/project/src/var` plus de drie beheersecrets in;
6. voer éénmalig `datastore:init` en `datastore:import-golden` tegen die disk uit;
7. zet pas later scheduling aan of configureer één marktgerichte externe trigger.

Een externe Postgres-adapter is een mogelijk later gratis alternatief, maar is niet stilzwijgend aan een Atlas-database gekoppeld. Koersplein blijft volledig zelfstandig.

## Nieuwe markt

Voeg een markt met MIC en instrumentcatalogus toe, seed de instrumenten op ISIN en geef jobs de betreffende MIC. De opslag, providerregistry, job-items en historie-API zijn niet hardcoded op een specifieke instrumentlijst; alleen de huidige catalog-seeder en beheerweergave zijn bewust op Amsterdam gericht.
