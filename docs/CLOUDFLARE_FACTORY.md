# Schaalbare Koersplein-datafabriek

## Productiegrens

De bestaande SQLite-fabriek blijft beschikbaar voor lokale tests en herstel. De productiearchitectuur gebruikt geen Render Web Service of persistente Render-disk:

- **Render Static Site** publiceert uitsluitend de frontend;
- **Cloudflare D1** bewaart markten, instrumenten, laatste koersen, historiedekking, partities, jobs, job-items en checkpoints;
- **Cloudflare R2** bewaart de omvangrijke OHLCV-historie;
- **Cloudflare Worker** levert historie, beveiligd beheer en de job-API;
- **één handmatig dispatchbare GitHub Actions-workflow** voert markt-/batchjobs uit.

De kern is marktneutraal: iedere markt heeft een MIC en iedere koerspartitie volgt `history/v1/mic=<MIC>/isin=<ISIN>/year=<JAAR>/prices.ndjson.gz`. Jaarpartities voorkomen dat één update een volledige bedrijfshistorie herschrijft. NDJSON + gzip is bewust gekozen boven Parquet zolang de gratis Worker de bestanden zelf leest en samenvoegt: het vereist geen zware runtime of externe library, comprimeert goed en laat één instrument/jaar onafhankelijk vervangen. Een toekomstige analytische export naar Parquet kan naast dit operationele formaat bestaan zonder het D1-model of de website te wijzigen.

## Eenmalige Cloudflare-inrichting

Er wordt door deze repository niets betaald of automatisch aangemaakt. Na het aanmaken van een gratis Cloudflare-account:

1. Maak een D1-database `koersplein-metadata` en R2-bucket `koersplein-history`.
2. Kopieer `cloudflare/wrangler.toml.example` naar `cloudflare/wrangler.toml` en vul alleen de D1-id en beheer-e-mail in. Commit dit lokale bestand niet.
3. Voer `npx wrangler d1 migrations apply koersplein-metadata --remote --config cloudflare/wrangler.toml` uit.
4. Publiceer de Worker met `npx wrangler deploy --config cloudflare/wrangler.toml`.
5. Zet Worker-secrets `FACTORY_TOKEN` en `GITHUB_DISPATCH_TOKEN` met `wrangler secret put`. Het GitHub-token hoeft uitsluitend `Actions: write` op Koersplein te hebben.
6. Beveilig `/beheer*` en `/api/admin/*` met Cloudflare Access en sta alleen de ingestelde beheer-e-mail toe.
7. Voeg in GitHub Actions-secrets `KOERSPLEIN_API_URL` en dezelfde `KOERSPLEIN_FACTORY_TOKEN` toe.
8. Draai eenmalig `npm run cloudflare:seed` en `npm run cloudflare:import-golden` met beide variabelen in de shell.
9. Vul daarna de Worker-URL in `data/runtime-config.json` in en laat de bestaande Render Static Site één keer publiceren.

Laat `SCHEDULER_ENABLED=false` tot de golden import en beheercontrole groen zijn. Daarna kan één marktgerichte dagelijkse trigger worden aangezet; er komt nooit een workflow per aandeel.

## Jobverloop

`/beheer` maakt in D1 een job en job-items aan en dispatcht de ene workflow. De runner claimt een configureerbare batch, werkt ieder instrument geïsoleerd af en schrijft na elk item status en checkpoint. Een herstart claimt alleen `PENDING`/`RETRY`; voltooide items worden niet opnieuw verwerkt. `HISTORY_BACKFILL`, `DAILY_UPDATE`, `REPAIR_MISSING`, `VALIDATE_HISTORY` en `CHECK_AMSTERDAM` gebruiken hetzelfde contract.

`DAILY_UPDATE` start na `last_date`. Een complete `HISTORY_BACKFILL` wordt een no-op. Providers blijven achter `ProviderRegistry`; Yahoo is alleen de aanwezige technische testadapter en geen definitieve commerciële bron.

## Schalen

D1 bevat geen massale dagelijkse historie, alleen kleine index- en statusrijen. R2 groeit lineair per instrumentjaar. Bij circa 60.000 bedrijven kunnen marktjobs worden opgesplitst in beperkte batches/concurrencygroepen; een storing blijft één job-item. Nieuwe markten vereisen catalogusdata met MIC en een provideradapter, niet een nieuw schema. Voor miljoenen analytische scans kan later een apart Parquet-/warehousepad worden toegevoegd; individuele grafieken blijven de compacte jaarobjecten lezen.

De volledige Amsterdam-backfill wordt in deze wijziging bewust niet gestart.
