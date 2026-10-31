# Koersplein Amsterdam — één programmeerlijn

**Actieve testtak:** `amsterdam-clean-20261031`. **Testsite:** https://koersplein-amsterdam-schoon.onrender.com. Productie/main blijft ongewijzigd.

## Enige gegevensroute

`data/euronext-amsterdam.json` (85 catalogusregels) → `data/amsterdam-history-manifest.json` (80 expliciet gekoppelde XAMS-aandelen) → `data/history/<ISIN>.json` (historische dagkoersen) → `amsterdam-week.js` en `share.js` / `chart.js`.

Geen Cloudflare Worker, Atlas, Europese market-registry, externe API of tweede databank voor de publieke Amsterdamse pagina's. Alle 80 histories blijven behouden. Niet-beschikbare of niet-gevalideerde koersen worden nooit verzonnen.

## Kwaliteit en historie

`npm test` valideert 80 identiteiten, de historie-indeling, alle vereiste webbestanden, JavaScript-syntaxis en het ontbreken van de oude Europa-API-koppelingen. De laatste koersdatum is **geen** garantie dat alle 80 aandelen op die datum een officieel slot hebben.

`npm run backtest:research` voert een **vaste historische baseline** uit: signalen op basis van uitsluitend voorafgaande zesmaands koersontwikkeling, met historische uitkomsten voor 3/6/12 maanden en grenzen van +10%/+20%. De laatste 30% van de mogelijke signalen per aandeel is het testvenster. De methode is niet gekalibreerd, niet gevalideerd voor splitsingen/dividenden, heeft overlappende waarnemingen en survivorship bias, en is geen beleggingsadvies of bewezen voorspeller.

## Volgende werkblokken

1. Onafhankelijk de publieke UI in een browser controleren: 80 regels, aandeel-detail, vier grafiekperioden, correcte ontbrekende dagen en resultaten.
2. Eén gratis, herhaalbare import met datum-, ISIN-, MIC-, volume-, open/slot- en broncontrole; alleen gecontroleerde data publiceren. Pas daarna dagelijkse planning inschakelen.
3. Betrouwbare, kalendergebaseerde walk-forward-tests zonder look-ahead, met corporate actions en onafhankelijke bronnen, voordat een voorspelling op de publieke site komt.

**Werkafspraak:** geen nieuwe Europa/Atlas/Worker-programmering in deze tak. Eén canonieke gegevensroute; bij uitbreidingen eerst deze README en de acceptatietest aanpassen. Oude ontwikkeltak blijft alleen als herstelarchief.

## Bronophaler: uitsluitend kandidaten, geen automatische import

`npm run fetch:candidates -- 2026-10-30 kandidaten.json` vraagt de openbare Euronext-tabel voor elk van de 80 ISINs op en bewaart kandidaten en fouten in een afzonderlijk JSON-bestand. De parser accepteert voorlopig uitsluitend direct leesbare HTML-tabellen; versleutelde antwoorden worden expliciet afgewezen. Deze beperking is bewust zichtbaar en mag niet worden verborgen met gefabriceerde koersen.

`scripts/fetch-amsterdam.mjs` zet `sourceVerified:false` en `sessionClosedVerified:false`. Dit is **niet** het invoerformaat van de gecontroleerde import. Een afzonderlijke onafhankelijke bron- en sessiecontrole ontbreekt nog. Er wordt niets automatisch gepubliceerd en er is geen dagelijkse scheduler.

`npm test` omvat ook vaste bronparser- en ophalertests met een gesimuleerde server, zodat netwerkuitval de bouwtest niet beïnvloedt.

## Vast ontwikkelprotocol (31 oktober 2026)

1. Werk per functioneel compleet blok; ontwerp, code, testfixtures en acceptatiecriteria horen bij elkaar. Voorkom losse cosmetische commits.
2. Bouw en test eerst lokaal. Lever bij iedere overdracht een ZIP of patch plus testresultaat en de exacte bestandenlijst. Een lokale PASS is **geen** GitHub- of Render-PASS.
3. Gebruik uitsluitend `amsterdam-clean-20261031` voor de Amsterdam-testomgeving. `main`/productie wordt nooit zonder expliciete toestemming aangepast.
4. Publiceer via één gecontroleerde commit of pull request, met een vergelijking tegen de huidige branch-head; geen force-push. Controleer daarna de commit-SHA en alle gewijzigde bestanden.
5. Render wordt pas na geslaagde repositorytests gedeployed. Controleer de buildlogs en status `live`. Meld een lopende build nooit als geslaagd.
6. Bij een geweigerde schrijfactie: **stop die route**, bewaar het geteste ZIP/patch-blok, meld precies wat niet gepubliceerd is en gebruik de reguliere GitHub Codespaces/CLI-route wanneer beschikbaar. Geen herhaald proberen om veiligheidscontroles te omzeilen.
7. Euronext-bronophaling blijft read-only totdat bronantwoorden, identiteit, handelsvolume, sessieafsluiting en herpublicatierechten onafhankelijk gecontroleerd zijn. Geen automatische import of scheduler op basis van alleen mocktests.

**Rapportage per blok:** lokaal getest / GitHub-commit bevestigd / Render-tests geslaagd / website live / resterende blokkades. Deze statussen mogen nooit worden samengevoegd.
