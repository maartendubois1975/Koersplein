# Gratis koersbronnen voor Milaan

Onderzoek van 26 november 2026. De opdracht blijft uitsluitend gratis bronnen gebruiken. Alle uitgevoerde bronproeven gebruikten openbare endpoints zonder API-sleutel of abonnement. Deze resultaten vormen brononderzoek en bevatten geen activering van imports.

## Volledige Yahoo-proef

De bestaande YahooChartProvider is gebruikt voor alle 360 geselecteerde bedrijven. Gevraagd venster was 25 november 2025 tot en met 25 november 2026. Er kwamen voor alle 360 bedrijven positieve-volumewaarnemingen terug, samen 78.425 records. Het register omvat 182 MTAA- en 178 EXGM-noteringen. De provider controleerde het aangevraagde Yahoo-symbool, EUR en Milan-beursmetadata. Yahoo levert daarmee gratis technische toegang voor de volledige selectie. De API levert geen eigen ISIN-bevestiging of onderscheid tussen MTAA en EXGM. Daarvoor blijft het individuele officiële register nodig.

Bij 306 bedrijven was de nieuwste teruggegeven koers van 24 november. Bij de overige 54 was die ouder. Het ontbreken van een candle bewijst op zichzelf geen handelsstilte. Het eerdere officiële bewijs voor 25 november blijft afzonderlijk bruikbaar als bronvergelijking.

De afzonderlijke 16-bedrijvenproef omvatte A2A, Ariston, BFF, Nocivelli, Creactives, DHH, Dotstay, gAIn360, Edison, IDNTT, Intred, Mondo TV France, Neurosoft, MFE B, Orange Media Group en Solid World. Deze leverde 2.773 complete OHLCV-waarnemingen op overlappende datums. Eén IDNTT-regel had onvolledige OHLC en is buiten de vergelijking gehouden. Voor representatieverschillen is maximaal max(1e-7, abs(prijs)*1e-6) toegestaan. Werkelijke verschillen blijven staan.

Er zijn 236 prijsverschillen en 232 volumeverschillen geteld. Daarvan komen 215 prijs- en volumeverschillen van Mondo TV France. De nieuwe ISIN ontstond bij een omgekeerde splitsing. Yahoo levert ook bars van vóór die nieuwe identiteit. Solid World heeft 16 prijs- en 17 volumeverschillen. BFF, DHH, Edison en MFE B hebben samen vijf andere prijsverschillen. Een automatische samenvoeging van de twee bronreeksen is daarmee nog onvoldoende onderbouwd.

Per-bedrijfmetingen staan in yahoo-360-coverage.csv. De onafhankelijke controles staan in yahoo-official-16-crosscheck.csv. De gedateerde totalen staan in summary.json.

## Andere gratis mogelijkheden

| Bron | Kosteloze mogelijkheden | Bevinding en bruikbaarheid |
|---|---|---|
| Euronext Live | Openbare historische tabellen met datum, OHLC en volume | In het eerdere blok technisch bewezen voor alle 360. Goed als officiële identiteits- en sessiecontrole. De toestemming voor openbare herpublicatie is apart te beoordelen. |
| Yahoo chart | Automatisch opvraagbare historische koersreeksen zonder sleutel | Nieuwe volledige proef geeft 360/360 niet-lege reeksen. Kansrijkste gratis historische route binnen de bestaande software. Achterstand en bedrijfsidentiteiten vragen controle. |
| Investing.com | Gratis historische tabellen, ook voor Nocivelli op Growth | Nocivelli toont op 25 november O/H/L/C 4,98/4,98/4,96/4,96 en volume 7.500, overeenkomstig de officiële meting. De openbare voorwaarden vereisen toestemming voor opslag en herpublicatie. Volledige 360-bedrijvendekking is niet getest. |
| Teleborsa | Publieke quote, ISIN, markt, laatste transactiedatum en grafiek | Orange Media is beschikbaar. Geschikt voor individuele controle op identiteit en gedateerde laatste koers. De voorwaarden beperken gebruik tot persoonlijk gebruik. Geen volledige automatische historische route bewezen. |
| Stock Analysis | Publieke historische tabellen voor Milanese aandelen | Eerdere proef op vier aandelen. Voor Orange Media gaf de tabel regels op dagen waarop de beurs geen handel bevestigde. De leverancier biedt volgens zijn eigen helpcentrum geen API of programmatische herdistributie aan. |
| FIDAtrader Free | Gratis MetaStock-database voor belangrijkste Italiaanse aandelen, met volgens aanbieder 20 jaar historie | Nieuwe concrete gratis kandidaat. Windows-programma, beperkte aandelenselectie en onbekende Growth-dekking. De gratis gebruiksovereenkomst moet eerst worden gelezen voordat deze als Koersplein-feed kan dienen. Geen volledige download of licentieacceptatie uitgevoerd. |
| Dukascopy | Gratis tick/OHLC-download voor 38 Italiaanse instrumenten | De bron is beperkt tot een deel van de markt. Volgens de bank berusten de prijs- en volumehistorie op bid/ask. Dit vereist een andere interpretatie dan uitgevoerde beurs-OHLCV. |
| Stooq | CSV-route onderzocht | A2A.IT, ENI.IT en A2A.MI gaven HTTP 404. Geen werkende Italiaanse koersroute aangetoond. Dit is geen bewijs dat ieder mogelijk Italiaans symbool ontbreekt. |

## Bronbesluit binnen het gratis beleid

Yahoo biedt nu aantoonbaar gratis technische dekking van alle 360 bedrijven. Een betaald abonnement is daarom geen noodzakelijke technische stap. De volgende inhoudelijke acceptatie betreft betrouwbare bewaartermijnen, de nieuwe Mondo TV France-identiteit, Intreds segmentgrens van 23 november, Solid World en de overige vijf prijsverschillen. De op 25 november afwezige Yahoo-bars blijven ontbreken tot dezelfde bron een werkelijk gedateerde koers levert. Oudere koersen kunnen met hun echte datum worden getoond.

Kosteloze toegang bewijst geen toestemming voor openbare opslag of herpublicatie. De gebruiksvoorwaarden van een gratis bron horen bij dezelfde beoordeling. Er is in dit blok geen nieuwe toestemming of betaalde overeenkomst aangenomen. De keuze van een onderzoeksbron activeert de geplande openbare dagcyclus niet.

## Bronnen

- https://query1.finance.yahoo.com/v8/finance/chart/A2A.MI
- https://uk.help.yahoo.com/kb/historical-prices-sln2311.html?redirect=true
- https://live.euronext.com/en/markets/milan/equities/list
- https://www.borsaitaliana.it/listino-ufficiale.htm
- https://nl.investing.com/equities/azienda-bresciana-petroli-nocivelli-historical-data
- https://uk.investing.com/about-us/terms-and-conditions/
- https://www.teleborsa.it/azioni/orange-media-group-omg-it0005733040-SVQwMDA1NzMzMDQw
- https://www.teleborsa.it/Avviso
- https://stockanalysis.com/help/faq/api-access/
- https://www.fidatrader.it/servizio/versione-free.html
- https://www.dukascopy-node.app/instruments/italy
- https://www.dukascopy.com/swiss/english/about/faq/?toEng=1
