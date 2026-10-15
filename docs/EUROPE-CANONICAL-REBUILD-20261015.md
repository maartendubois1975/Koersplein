# Europa: inventarisatie en gecontroleerde consolidatie — 15 oktober 2026

## Uitgangspunt en waarheidshiërarchie
**Behoud de bestaande, werkende 31-marktenkoersketen op main.** De gebruiker noemt 32 landen; de actuele `data/world-fill-plan.json` bevat 31 markten met status COMPLETE. Een markt is geen land: verifieer eerst het ontbrekende/extra land of beurssegment vóór een telling wordt aangepast. Geen nieuwe koersimporter ontwerpen voordat bestaande bronnen en opgeslagen historie zijn vergeleken.

## Geïnventariseerde productieonderdelen (main, tree 388 entries)
- **Website:** `index.html`, `market.html`, `share.html`, `amsterdam.html`, `brussel.html`, `parijs.html`, `milaan.html`, `oslo.html`, `stockholm.html`, `zurich.html`, `lissabon.html`, `kansscanner.html`, `research-lab.html`, `resultaten-verleden.html`, `beheer/index.html`, `app.js`.
- **Opslag/API:** `cloudflare/worker.mjs`, `cloudflare/migrations/0001_initial.sql`, `scripts/cloudflare/client.mjs`, `scripts/cloudflare/factory-runner.mjs`, `scripts/cloudflare/universal-market-runner.mjs`.
- **Koersproviders:** `scripts/history/provider-registry.mjs`, `scripts/history/providers/{yahoo-chart,euronext-live,yahoo-isin,stockanalysis-bit,nasdaq-baltic,zse-price-list}.mjs`. Registry probeert meerdere providers bij fouten.
- **Catalogi/bronnen:** `data/euronext-*.json` (31 marktcatalogi), `data/market-source-registry.json`, `data/world-fill-plan.json`, `scripts/cloudflare/universal-source-{catalog,audit}.mjs`.
- **Research:** `scripts/research/complete-market-pipeline.mjs` gebruikt complete-market-gate, opportunity-map, universal-market-machine1, relative-specialist, independent-market-judge. `scripts/research/europe-machine-arena-readiness.mjs` plus block1–6 tests.
- **Productie-workflows:** `.github/workflows/{daily-open-close,complete-market-analysis,machine-arena-europe,universal-source-first,codebase-audit,daily-opportunity-ledger}.yml`.

## Belangrijkste bevindingen
1. `data/world-fill-plan.json` markeert 31 markten COMPLETE; dit is *planningsstatus*, geen actuele controle van D1-historie.
2. `scripts/cloudflare/universal-market-runner.mjs` kan een bestaande D1-identiteit voor MIC+ticker hergebruiken en anders een interne `MIC-TICKER` sleutel aanmaken. Een ontbrekende officiële ISIN betekent dus **niet** automatisch ontbrekende historische koersen.
3. `scripts/history/provider-registry.mjs` heeft al zes historische koersproviders en fallback. De nieuwe identiteitsgate mag deze bestaande historie niet verbergen of overschrijven.
4. `.github/workflows/complete-market-analysis.yml` start een matrix over alle COMPLETE-markten en uploadt markt-artifacts; `.github/workflows/machine-arena-europe.yml` valideert architectuurcontracten. Groene contracttests zijn geen bewijs van actuele end-to-end koersdekking.
5. Nieuwe Europe quality-gate wijzigingen staan op `fix/arena-history-quality-gate-20261010` (PR #74), **niet op main**. Niet samenvoegen voordat de bestaande D1-identiteiten, de historie en de onafhankelijke kwaliteitsgate zijn gemapt.
6. De huidige live D1-database, echte productie-URL en de laatste volledige 31-marktrun zijn niet uit een GitHub-bestandsinventaris af te leiden. Zonder die meting is een definitieve verwijdering van runtime-code onverantwoord.

## Canonieke nieuwbouw: consolidatie in grote, toetsbare blokken
**A. Waarheid meten:** lees productie-/staging-API `historyManifest` en catalog per MIC, vergelijk 31 marktbestanden met D1 MIC+ticker, aantallen historische bars, oudste/nieuwste koers, provider, mislukte mappings en status; publiceer reproduceerbaar coverage-rapport. Controleer of een 32e markt/land buiten het huidige plan zit.

**B. Eén identiteit, één koerspad:** maak een mapping `MIC+ticker ↔ bestaande D1 sleutel ↔ officiële ISIN (indien beschikbaar)`. Behoud historische sleutel en bars; nooit 392 Poolse historische reeksen weggooien wegens lege ISIN. Koppel officiële identiteitscontrole als aanvullende bewijslaag, zonder data te dupliceren.

**C. Eén uitvoeringsketen:** breng bronselectie, backfill, dagupdate, research, onafhankelijke beoordeling en publicatie onder één aantoonbare state-machine. Elimineer dubbele routes pas nadat hun afnemers naar het bewezen pad zijn omgezet.

**D. Definitief opschonen:** maak eerst een machineleesbare dependency-/callsite-inventaris van alle HTML, JS, workflows, CLI, imports en Cloudflare-routes. Verwijder daarna alleen bestanden/routes zonder live of migratieafnemers, in één samenhangende PR, inclusief tests die op achtergebleven referenties falen. **Geen blind verwijderen** van `scripts/factory/`, `scripts/archive/`, historische provideradapters, datafiles of bestaande HTML: status `candidate` is geen bewijs van ongebruikt.

**E. Volledige bewijsrun:** vergelijk voor/na per MIC instrumenten, historische bars, laatste datum, dagelijkse updates, 11 machines, onafhankelijke holdout en website/API. Pas dan productiepromotie en oude code definitief verwijderen.

## Acceptatiecriteria
- 31/31 huidige markten behouden of aantoonbaar en expliciet gemigreerd; 32e land/markt apart geïdentificeerd.
- Geen verlies van bestaande koersreeksen of D1-identiteiten; nul onverklaarde historische dalingen.
- Eén canonical producer per dataset en één gedocumenteerde bronketen.
- Elke verwijderde module heeft bewijs van nul actieve aanroepers en geslaagde regressie.
- Werkelijke historische dekking per markt zichtbaar; certificeringsstatus apart van datadekking.
- Geen productieclaim zonder actuele run/artifact en database-/API-bewijs.

## Volgende uitvoering
Begin met **A+B samen**, niet met een losse ISIN-fix of extra testassertie. Pas daarna zijn definitieve deletions veilig. Dit bestand is het werkcontract voor de consolidatie.
