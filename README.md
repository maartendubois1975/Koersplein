# Koersplein

Koersplein brengt aandelenbeurzen één voor één in beeld. De hoofdstructuur is uitbreidbaar opgezet als `beursgroep → markt → index → aandeel`. De eerste volledig beschikbare markt is Euronext Amsterdam.

Koersplein is een zelfstandig project. Er bestaat geen technische koppeling met Atlas en er wordt geen code of data uit Atlas gebruikt.

## Lokaal bekijken en controleren

```bash
npm run dev
npm run validate
```

Open na `npm run dev` http://localhost:4173.

## Data

- `data/markets.json` bevat de uitbreidbare Euronext-marktstructuur. Nieuwe markten krijgen ieder hun eigen aandelen- en indexbestand.
- `data/euronext-amsterdam.json` bevat alle Amsterdamse aandelen.
- `data/euronext-amsterdam-indices.json` bevat de officiële indexsamenstellingen. De frontend koppelt uitsluitend op ISIN. Een Amsterdamse ISIN die niet in AEX, AMX of AScX staat, valt automatisch onder Overig.

De kleine index heet bij Euronext tegenwoordig **AMS Next 20**. In de navigatie blijft de voor gebruikers bekende en gevraagde naam **AScX** zichtbaar; `officialName` bewaart de officiële naam.

## Amsterdamse aandelenlijst vernieuwen

```bash
npm run update:amsterdam
npm run validate
```

De import haalt de officiële aandelenlijst rechtstreeks op bij Euronext en verandert de indexindeling niet.

## Indexsamenstellingen vernieuwen

Gebruik de drie officiële Euronext-pagina's die in ieder indexobject onder `source` staan:

- AEX: ISIN `NL0000000107`
- AMX: ISIN `NL0000249274`
- AMS Next 20 (zichtbaar als AScX): ISIN `NL0000249142`

Neem op de controledatum de volledige tabel **Index Composition** over in `constituents`, met ISIN als sleutel, werk `asOf` bij en voer daarna `npm run validate` uit. De validator blokkeert dubbele lidmaatschappen, ontbrekende Amsterdamse ISIN's en afwijkende groepsgroottes. Daardoor kan een naamswijziging geen verkeerde koppeling veroorzaken en komen niet-ingedeelde aandelen vanzelf onder Overig.

Voor indexherzieningen zijn de actuele live compositietabellen leidend; publicaties onder *Index announcements* op Euronext dienen als tweede controle. Er is bewust geen automatische GitHub-workflow toegevoegd: vernieuwen gebeurt gecontroleerd en veroorzaakt geen periodieke Actions- of deploymentkosten.
