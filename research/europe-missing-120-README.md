# Europa: 120 ontbrekende historische koersreeksen

Bron: geslaagde GitHub-inventarisatie run 39099235874 op 18 oktober 2026. **Dit zijn ontbrekende koersreeksen, niet bewezen onvindbare beursgegevens.**

De 120 individuele beursnoteringen staan in [europe-missing-120-dossier.csv](europe-missing-120-dossier.csv). Elk item heeft beurs, ISIN, ticker, naam, bronroute en expliciet `publicationApproved=NO`.

Onderzoeksvolgorde: Parijs (53), Londen (19), Cyprus (11), Amsterdam (10), Brussel (9), daarna de overige 18. Controleer per item beursnotering, tickerhistorie, handelsstatus, handelsdata, OHLC en valuta. Pas na bronverificatie en controle van duplicaten mag import plaatsvinden. Bewaar oude D1/R2-koersen, append-only.

Officiële bronmogelijkheden voor Euronext-markten: https://live.euronext.com/en/popout-page/getHistoricalPrice/NL0000000107-XAMS en https://www.euronext.com/en/data/how-access-market-data/web-services. Beschikbaarheid per aandeel is nog **niet** bevestigd. Eventuele licenties en herpublicatierechten moeten apart worden gecontroleerd.

Geen geautomatiseerde productie-import vanuit dit dossier. De lopende Europe-backfill is onafhankelijk en niet gestopt.
