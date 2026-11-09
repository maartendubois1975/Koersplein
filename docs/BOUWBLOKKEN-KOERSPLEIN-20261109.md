# Koersplein: zes uitvoerbare bouwblokken naar één koersketen
Datum: 2026-11-09. Status: uitvoering, geen productiemigratie geautoriseerd.

## Randvoorwaarden
- Productie (`main`, Render, Cloudflare live) blijft ongewijzigd zonder expliciete toestemming.
- Behoud ISIN/MIC-identiteit, officiële bronstatus, OHLC-validatie, handelskalender en append-only waar vereist.
- Eerst bestaande implementaties vergelijken, dan schrappen; geen extra parallelle scheduler.
- Iedere fase levert code, reproduceerbare tests, een bron-/doeloverzicht en een expliciete go/no-go.
- Een geslaagde syntaxis- of unittestrun is niet gelijk aan een geslaagde dagelijkse koersupdate.

## Bouwblok 1 — Branch- en workflowconvergentie
Doel: één gezaghebbende ontwikkelbasis; zonder bestaande Amsterdam-data te overschrijven.
Inventariseer verschillen tussen `main`, `amsterdam-reset-20261027`, `amsterdam-clean-20261031`, `codex/koersplein-home-history` en deze branch. Classificeer per gewijzigde module: behouden, overnemen, vervangen, archiveren. Controleer scheduler/workflow-triggers en de bestemming van elke git push.
Acceptatie: machineleesbaar branchverschillenrapport; expliciete keuze voor leidende Amsterdam-import; geen ongecontroleerde merge; CI groen.

## Bouwblok 2 — Eén canonieke catalogus Amsterdam/Brussel
Doel: correcte actieve primaire ondernemingen, zonder dubbele listings of fondsen die buiten scope vallen.
Controleer `data/euronext-amsterdam.json`, `data/euronext-brussels.json`, officiële MIC/ISIN en `data/world-fill-plan.json`. Scheid broninventaris van publiceerbare primaire bedrijfsnoteringen. Bewaar bronverwijzing en reden van elke uitsluiting.
Acceptatie: reproduceerbare catalogusvalidatie, nul onverklaarde dubbele ISIN/MIC-records en een expliciete lijst van onbesliste gevallen. Geen willekeurige verwijdering om een streefaantal te bereiken.

## Bouwblok 3 — Eén importketen, zonder concurrerende schrijvers
Doel: gedeelde catalogus- en OHLC-verwerking met één eigenaar per markt/dataset.
Herbruik `scripts/cloudflare/history-writer.mjs`, `scripts/audit/authorize-market-shard.mjs` en bestaande provider-registry. Vergelijk `scripts/history.mjs`, `scripts/cloudflare/factory-runner.mjs`, `universal-market-runner.mjs`, `daily-open-close-update.mjs`, `reconcile-official-daily.mjs`, `sync-plan.mjs` en `import-golden.mjs`. Verwijder oude paden pas nadat hun vervanger dezelfde data produceert.
Acceptatie: één gedeclareerde eigenaar per markt/dataset, één gecontroleerde dry-run, geen dubbele historische opslagcode en geen ongeautoriseerde catalogusmutatie.

## Bouwblok 4 — Historie, dagelijkse OHLC en voorspellingen
Doel: dagelijkse open/slot/hoge/lage koersen en 1/3/6/12-maandsgrafieken, voorspellingen 3/6/12 maanden.
Controleer per beurs bronkwaliteit, ontbrekende sessies, handelsvrije dagen, afwijkende valuta, corporate actions en forecast-input. Gebruik bestaande testfixtures; niet voorspellen op ontbrekende of onbetrouwbare historie.
Acceptatie: Amsterdam en Brussel doorlopen dezelfde pipeline; reproduceerbare fixtures en gecontroleerde voor/na-dekking.

## Bouwblok 5 — Staging en integratie
Doel: één stagingdienst met dezelfde artefacten als de beoogde productie, zonder productie te raken.
Controleer GitHub Actions, Render service/branch/autodeploy, Cloudflare Worker-credentials en schrijfdoelen. Run gecontroleerde staging-backfill, dagelijkse update, API/UI en forecast-tests. Bewijs dat productie niet gewijzigd is.
Acceptatie: volledige end-to-end-run op staging met auditrapport, rollback-plan en geen onverklaarde verschillen.

## Bouwblok 6 — Opschonen en gereedmaken voor gecontroleerde omschakeling
Doel: onnodige workflows, oude branches, dubbele scripts en guardrails op basis van bewijs opruimen.
Maak een exact verwijderingsvoorstel met aanroepgrafiek, afhankelijkheden, vervanger, risico en rollback. Voer alleen ontwikkelbranchwijzigingen uit; productie- of livejobwijzigingen vereisen afzonderlijke expliciete goedkeuring.
Acceptatie: alle CI- en stagingtests groen, één operationele route, verwijderingslijst geverifieerd, documentatie actueel en expliciet productie-go/no-go.

## Huidige geverifieerde uitgangspositie
- GitHub compare `main...amsterdam-reset-20261027`: 354 commits vooruit, 34 achter, 152 gewijzigde bestanden (2026-11-09).
- Consolidatie-CI t/m commit `3de1320b`: geslaagd.
- `config/writer-routes.json` blijft disabled: consolidatie is nog niet live.
- Geen bewijs dat Render/Cloudflare productie end-to-end is gecontroleerd.

## Rapportageregel
Geen status na losse commits. Rapporteer pas bij een afgerond bouwblok, een noodzakelijke autorisatie of een aantoonbare externe blokkade. Markeer elke fase afzonderlijk als NIET GESTART, IN UITVOERING, GESLAAGD of GEBLOKKEERD. Geen automatische achtergronduitvoering claimen.
