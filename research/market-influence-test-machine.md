# Koersplein — onderzoeks- en testmachine: factoren achter aandelenkoersen

Status: VASTGELEGD ALS ONDERZOEKSPROGRAMMA — GEEN PRODUCTIEACTIVATIE
Vastgelegd: 2026-10-23
Aanleiding: Gaming Wall Street (2022), GameStop-casus en expliciete productwens om koersbeïnvloedende marktkrachten structureel te onderzoeken.

## Opdracht aan de onderzoeksmachines
Onderzoek **welke aantoonbare factoren** een aandeelprijs en handelsvolume kunnen beïnvloeden, hoe die factoren worden gemeten, met welke vertraging gegevens beschikbaar zijn, en of we ze rechtmatig op Koersplein mogen tonen. Behandel de factoren niet als bewezen oorzaken voor afzonderlijke koersbewegingen zonder passende onderbouwing.

### Onderzoeksgebieden en kandidaat-features
1. Short interest / netto shortposities: openstaande posities, publicatiedatum, drempels, beschikbare float. Maak expliciet onderscheid tussen **short interest** (openstaande posities) en **short sale volume** (verhandeld volume).
2. Short squeezes en gedwongen terugkoop: meet samenloop van hoge short interest, prijsstijgingen, volume en liquiditeit; nooit automatisch een squeeze of manipulatie claimen.
3. Opties: put/call-volume, open interest, expiraties en mogelijke dealerhedging; datarechten en tijdsvertraging toetsen.
4. Marktstructuur: off-exchange trading, dark pools, wholesaling, payment for order flow, handelsstops, brokerbeperkingen en settlement/failures to deliver. Off-exchange volume is geen direct bewijs van manipulatie.
5. Social media / nieuws: Reddit, publieke nieuwsgebeurtenissen, sentiment, bedrijfsnieuws en invloed van media-aandacht; bronkwaliteit en meetbias bewaken.
6. Grote houders en institutionele stromen: openbare eigendomsmeldingen, meldingsdrempels en vertraging.
7. Fundamentele en macrofactoren: bedrijfsresultaten, omzet, winst, guidance, dividend, splits, rente, inflatie, wisselkoersen, sectorontwikkelingen en economische schokken.
8. Liquiditeit en microstructuur: handelsvolume, spread, free float, volatiliteit, orderboekdiepte waar toegestaan, corporate actions.

## Officiële eerste bronnen
- SEC GameStop/marktstructuur rapport (2021): https://www.sec.gov/newsroom/press-releases/2021-212
- SEC rapport: https://www.sec.gov/about/reports-publications/staff-report-equity-options-market-structure-conditions-early-2021
- ESMA short selling reporting: https://www.esma.europa.eu/data-reporting/ssr-reporting
- AFM actueel netto shortregister: https://www.afm.nl/nl-nl/sector/registers/meldingenregisters/netto-shortposities-actueel
- FINRA short interest / short sale volume: eerst officiële definities, downloadmogelijkheden en hergebruikvoorwaarden vaststellen.

## Testmachine — vereiste resultaten per factor
Per factor een testkaart met: hypothese, meetbare indicator, geografische dekking (VS / EU / per beurs), ISIN+MIC / ticker-identiteit, bron en hergebruiklicentie, publicatievertraging, historische beschikbaarheid, ontbrekende data, kosten, validatie, en of er slechts correlatie of ook onafhankelijke causale onderbouwing is.

Eerste pilot: historische GameStop-periode januari 2021 met SEC-rapport als feitenbasis; vergelijk koers, volume, short interest, optiedata en media-aandacht uitsluitend voor zover betrouwbare historische bronnen beschikbaar zijn. Tweede pilot: Europees aandeel met officiële netto-shortmeldingen en bestaande koershistorie, eerst in een geïsoleerde dataset.

## Publicatie- en veiligheidsregels
- Toon meetdatum en publicatiedatum apart; vermijd look-ahead bias.
- Geen voorspellingen of manipulatieclaims op basis van één indicator.
- Publicatie van shortposities onder wettelijke meldingsdrempels is onvolledig; geen melding betekent niet nul short.
- Leg onvolledige of niet-vergelijkbare data zichtbaar uit.
- Geen scraping, opslag of herpublicatie zonder toepasselijke rechten.
- Testmachine is read-only; geen productie-workflows, koershistorie of bestaande tabellen aanpassen.
- Pas na geslaagde tests en licentiecontrole een aparte feature 'Achter de Koers / Marktdruk en handelsactiviteit' voorstellen.

## Samenhang met Europa
Dit onderzoeksprogramma is **geen vervanging** voor de Europese OHLCV-herstelroute. De Europese dagelijkse koersvoorziening moet onafhankelijk worden hersteld en geverifieerd. De nieuwe indicatoren zijn een latere, afzonderlijke laag boven op correcte koershistorie.
