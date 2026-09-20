# Verplichte bronverkenning vóór iedere nieuwe beurs

Koersplein mag een nieuwe beurs **niet** backfillen voordat een brononderzoek is afgerond en in `data/market-source-registry.json` op `APPROVED` staat.

Vaste volgorde:
1. officiële beurscatalogus/MIC en instrumenttypes vaststellen;
2. minimaal Yahoo, officiële beursbron en ten minste twee gespecialiseerde databronnen onderzoeken;
3. minimaal 10 moeilijke/kleine/dubbele noteringen testen (of alle probleemgevallen als dat er minder zijn);
4. historie-diepte, OHLCV, ISIN/ticker-koppeling, delistings, rate limits, kosten en gebruiks-/redistributierechten vastleggen;
5. PRIMARY + FALLBACK kiezen;
6. pas daarna catalogus/backfill/validatie starten.

De universele runner voert deze gate technisch af. Zonder APPROVED source-discovery dossier stopt de run vóórdat providerverkeer of backfill begint.

## Parijs
Catalogus: officiële Euronext product directory. Bestaande opgeslagen historie: Yahoo primair, Euronext fallback. De bronverkenning identificeert EODHD en Financial Modeling Prep als eenvoudigere API-kandidaten voor de dunne Growth/Access-staart. Zij worden niet stilzwijgend gebruikt zonder sleutel en passende gebruiksrechten. Geen koersdata wordt verzonnen.
