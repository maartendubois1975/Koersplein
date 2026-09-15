# Koersplein

Koersplein is een zelfstandig financieel webproject. De site ordent de beurswereld als `regio → beursgroep → markt → index → aandeel`. Europa / Euronext / Amsterdam is actief; andere regio's en Euronext-markten zijn als toekomstige, lege onderdelen zichtbaar. Er is geen technische koppeling met Atlas en geen Atlas-code, -data of -workflow opgenomen.

## Site

De donkere, responsive homepage bevat:

- een echte introductie en marktpositionering;
- de interactieve Kanszoeker voor termijn, gezocht koerspotentieel en 1–5 aandelen;
- een expliciete `engine_unavailable`-status: geen fictieve voorspellingen of rendementsbeloften;
- datacontracten voor een later pakketresultaat met weging, potentieel, sector, land, beurs, spreiding/risico en modelbasis;
- lege, eerlijke kaarten voor wereldwijde stijgers en dalers;
- navigatie via Europa → Euronext → Amsterdam → AEX / AMX / AScX / Overig;
- zoeken op bedrijfsnaam, ticker en ISIN;
- een aandeel-detailpagina via `share.html?isin=...` met een echte, lichte SVG-koersgrafiek voor de twee golden test cases, inclusief 1J/3J/5J/10J/MAX.

`data/home-contracts.json` is het frontendcontract voor Kanszoeker en dagwinnaars/-verliezers. Het bevat schema's, geen verzonnen resultaten.

## Lokaal draaien en testen

Node.js 20 of nieuwer volstaat; er zijn geen npm-afhankelijkheden.

```bash
npm run dev
npm test
```

Open http://localhost:4173. De validator controleert de 124 aandelen, unieke ISIN's, indexgroottes 30/25/20/49, marktstructuur, veilige lege UI-statussen en de twee gecontroleerde historiekoppelingen. De test controleert daarnaast de keuzeknoppen, zoekvelden, detailroute, historievalidatie, foutfilter, moversberekening en idempotente merge.

## Amsterdam-data en indices

- `data/markets.json`: uitbreidbare Euronext-markten.
- `data/regions.json`: uitbreidbare wereldregio's.
- `data/euronext-amsterdam.json`: 124 bestaande Amsterdamse noteringen; ongewijzigd behouden.
- `data/euronext-amsterdam-indices.json`: officiële Euronext-samenstellingen, gekoppeld op ISIN.

Niet-ingedeelde Amsterdamse ISIN's vallen automatisch onder Overig. De officiële naam van de kleine index is **AMS Next 20**; de UI toont daarnaast de herkenbare naam **AScX**.

De aandelenlijst wordt gecontroleerd vernieuwd met:

```bash
npm run update:amsterdam
npm run validate
```

De drie actuele indexpagina's staan per index in het databestand. Werk bij een herweging de volledige Euronext-compositietabel en `asOf` bij en draai daarna de validator. Er is bewust geen periodieke GitHub-workflow.

## Historische data-architectuur

`scripts/history/engine.mjs` verzorgt validatie, merge, atomaire opslag, batches, foutisolatie en checkpointing. Providers zitten achter adapters onder `scripts/history/providers/`. Het uniforme bestand per instrument wordt `data/history/<ISIN>.json` en bevat:

- officiële instrumentidentiteit: naam, ticker, ISIN, MIC, markt en valuta;
- dagelijkse datum, open, high, low, close, adjusted close en volume;
- null voor een ontbrekend niet-kritiek veld; bruikbare andere dagen blijven behouden;
- provider, providersymbool, ophaaldatum, requestmetadata en licentienotitie;
- eerste datum, laatste datum en record-/volumedekking.

Opslag is idempotent op handelsdatum. Een voltooide backfill krijgt `backfillComplete`; een herhaalde backfill is daarna een echte no-op zonder providerrequest. Een update begint na de laatst opgeslagen dag, bestaande historie wordt niet verwijderd bij een bronfout en fouten worden per instrument in `data/history/status.json` vastgelegd. Batchgrootte is configureerbaar met `--batch-size` of `KOERSPLEIN_BATCH_SIZE`.

### Providerkeuze

Euronext blijft de gezaghebbende bron voor ISIN/MIC/ticker en biedt professionele historische data als gelicentieerd product. Voor de twee technische backfilltests is een vervangbare **Yahoo Finance chart-feedadapter** gebouwd, omdat die zonder sleutel dagelijkse OHLCV en adjusted close kan leveren voor Amsterdam-symbolen. De mapping staat expliciet per ISIN in `data/history-instruments.json`; de adapter controleert providersymbool, Amsterdam-beurs en EUR-valuta voordat data wordt opgeslagen.

De Yahoo-feed is geen contractueel gegarandeerde productie-API. Commerciële herdistributierechten zijn niet aangetoond. Gebruik deze adapter dus voor de technische testcase; sluit vóór publieke commerciële koerspublicatie een passende licentie af bij Euronext of een professionele provider en voeg/vervang alleen de adapter.

### Alleen ASML en Adyen testen

```bash
npm run history:test
npm run history:status
npm run history:test
npm run history:movers
```

De ingebouwde tweede backfillrun moet `unchanged`, `backfill-complete` en `providerRequest: false` melden. Daarna valideert de build alle records en schrijft `data/history/manifest.json`. De frontend resolveert de bestandsnaam uitsluitend via dit manifest en controleert ISIN, ticker, MIC, recordaantal, volgorde en unieke handelsdagen. De moversuitvoer heet bewust `configured-test-universe` en wordt niet als wereldwijde Top 10 gepubliceerd.

Een lichte dagelijkse update van uitsluitend de geconfigureerde instrumenten:

```bash
npm run history:update
```

Een individueel instrument:

```bash
node scripts/history.mjs backfill --isin NL0010273215 --batch-size 1
```

### Later alle Amsterdamse aandelen

Voeg eerst per Amsterdamse ISIN een gecontroleerde providerkoppeling toe aan `data/history-instruments.json`. Start daarna één hervatbare batch, niet één workflow per aandeel:

```bash
KOERSPLEIN_ALLOW_FULL_BACKFILL=yes node scripts/history.mjs backfill --all --batch-size 10
```

De expliciete omgevingsvlag voorkomt een onbedoelde dure volledige backfill. In dit bouwblok worden uitsluitend ASML en Adyen geconfigureerd; de overige 122 aandelen worden bewust niet opgehaald.

## Deployment

De publieke testsite is `https://koersplein-test.onrender.com`. Render publiceert de repositoryroot na `npm test && npm run history:test`; die laatste stap genereert, auditeert en manifesteert uitsluitend ASML en Adyen voordat het artifact wordt geüpload. Auto-deploy blijft uit: één handmatige deploy per gecontroleerd bouwblok. Er is geen GitHub Action of nieuw hostingbestand toegevoegd en er staan geen secrets in de frontend.
