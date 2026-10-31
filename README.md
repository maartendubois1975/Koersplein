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
