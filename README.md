# Koersplein Amsterdam — één programmeerlijn

**Actieve testtak:** `amsterdam-clean-20261031`. **Testsite:** https://koersplein-amsterdam-schoon.onrender.com. Productie/main blijft ongewijzigd.

## Enige gegevensroute

`data/euronext-amsterdam.json` (85 catalogusregels) → `data/amsterdam-history-manifest.json` (80 expliciet gekoppelde XAMS-aandelen) → `data/history/<ISIN>.json` (historische dagkoersen) → `amsterdam-week.js` en `share.js` / `chart.js`.

Geen Cloudflare Worker, Atlas, Europese market-registry, externe API of tweede databank voor de publieke Amsterdamse pagina's. Alle 80 histories blijven behouden. Niet-beschikbare of niet-gevalideerde koersen worden nooit verzonnen.

## Kwaliteit en historie

`npm test` valideert 80 identiteiten, de historie-indeling, alle vereiste webbestanden, JavaScript-syntaxis en het ontbreken van de oude Europa-API-koppelingen. De laatste koersdatum is **geen** garantie dat alle 80 aandelen op die datum een officieel slot hebben.

`npm run backtest:research` voert een **vaste historische baseline** uit: signalen op basis van uitsluitend voorafgaande zesmaands koersontwikkeling, met historische uitkomsten voor 3/6/12 maanden en grenzen van +10%/+20%/+30%. De laatste 30% van de mogelijke signalen per aandeel is het testvenster. De methode is niet gekalibreerd, niet gevalideerd voor splitsingen/dividenden, heeft overlappende waarnemingen en survivorship bias, en is geen beleggingsadvies of bewezen voorspeller.

## Volgende acceptatiecontroles

1. Controleer de GitHub Actions-import op een echte Euronext-sessie, inclusief 80 identiteiten, geaccepteerde bronrecords, commit van de historie en eventuele bronuitval.
2. Controleer onafhankelijk de publieke UI in een browser: 80 regels, aandeel-detail, vier grafiekperioden en ontbrekende dagen.
3. Bouw daarna kalendergebaseerde walk-forward-tests met corporate actions en point-in-time-universum voordat voorspellingen publiek worden.

**Werkafspraak:** geen nieuwe Europa/Atlas/Worker-programmering in deze tak. Eén canonieke gegevensroute; bij uitbreidingen eerst deze README en de acceptatietest aanpassen. Oude ontwikkeltak blijft alleen als herstelarchief.

## Bronophaler en gecontroleerde import

`npm run fetch:candidates -- 2026-10-30 kandidaten.json` vraagt de openbare Euronext-tabel voor elk van de 80 ISINs op en bewaart kandidaten en fouten in een afzonderlijk JSON-bestand. De parser accepteert voorlopig uitsluitend direct leesbare HTML-tabellen; versleutelde antwoorden worden expliciet afgewezen. Deze beperking is bewust zichtbaar en mag niet worden verborgen met gefabriceerde koersen.

`scripts/fetch-amsterdam.mjs` zet `sourceVerified:false` en `sessionClosedVerified:false`. Dit is **niet** het invoerformaat van de gecontroleerde import. De aparte verificatiestap `scripts/verify-amsterdam.mjs` controleert identiteit, Euronext-bronadres, OHLCV en gesloten sessie voordat `scripts/import-amsterdam.mjs` uitsluitend geldige records toevoegt. Een workflow op `main` plant deze verwerking op werkdagen voor de geïsoleerde ontwikkeltak. Dit is nog geen bewijs van een geslaagde live import of van herpublicatierechten.

`npm test` omvat ook vaste bronparser- en ophalertests met een gesimuleerde server, zodat netwerkuitval de bouwtest niet beïnvloedt.

## Vast ontwikkelprotocol (31 oktober 2026)

1. Werk per functioneel compleet blok; ontwerp, code, testfixtures en acceptatiecriteria horen bij elkaar. Voorkom losse cosmetische commits.
2. Bouw en test eerst lokaal. Lever bij iedere overdracht een ZIP of patch plus testresultaat en de exacte bestandenlijst. Een lokale PASS is **geen** GitHub- of Render-PASS.
3. Gebruik uitsluitend `amsterdam-clean-20261031` voor de Amsterdam-testomgeving. `main`/productie wordt nooit zonder expliciete toestemming aangepast.
4. Publiceer via één gecontroleerde commit of pull request, met een vergelijking tegen de huidige branch-head; geen force-push. Controleer daarna de commit-SHA en alle gewijzigde bestanden.
5. Render wordt pas na geslaagde repositorytests gedeployed. Controleer de buildlogs en status `live`. Meld een lopende build nooit als geslaagd.
6. Bij een geweigerde schrijfactie: **stop die route**, bewaar het geteste ZIP/patch-blok, meld precies wat niet gepubliceerd is en gebruik de reguliere GitHub Codespaces/CLI-route wanneer beschikbaar. Geen herhaald proberen om veiligheidscontroles te omzeilen.
7. De reeds ingestelde ontwikkelworkflow schrijft uitsluitend geverifieerde koersrecords naar de geïsoleerde tak. Verificatie in code is niet gelijk aan onafhankelijke bron- en herpublicatierechtencontrole. Geen productiepublicatie zonder live acceptatie en rechtencontrole.

**Rapportage per blok:** lokaal getest / GitHub-commit bevestigd / Render-tests geslaagd / website live / resterende blokkades. Deze statussen mogen nooit worden samengevoegd.

## Importbeleid (5 november 2026)

`scripts/run-amsterdam-daily.mjs` gebruikt uitsluitend `scripts/amsterdam-import-plan.mjs`: maximaal drie recente ontbrekende beursdagen plus één roterende historische inhaaldag per uitvoering. Daardoor verhindert een lang achterblijvend aandeel niet het ophalen van de recentste sessie. De kalender sluit weekenden uit, maar beursfeestdagen worden niet als bewezen handelsdagen behandeld: afwezige bronrecords blijven ontbrekend. Een roterende historische dag garandeert niet dat alle oude gaten snel worden gedicht; achterstanden blijven in het importrapport zichtbaar. De planner wordt door `scripts/test-amsterdam-import-plan.mjs` getest. `npm test` is structurele verificatie; alleen de afzonderlijke live workflow kan echte import bewijzen.
