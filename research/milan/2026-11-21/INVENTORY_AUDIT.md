# Milaan — eerste inventarisaudit (2026-11-21)

**Status: onderzoeksbestand, geen goedgekeurde bedrijvenlijst.** Bron: bestaande `data/euronext-milan.json` van 2026-09-29. Niets geïmporteerd of gepubliceerd.

## Reproduceerbare telling
- Ruwe directoryregels: **445**.
- Afgewezen volgens oude import: 3 zonder identiteit en 41 niet-aandelen.
- Overgebleven instrumentregels: **401**; 197 MTAA (Euronext Milan) en 204 EXGM (Growth).
- Geen dubbele ISIN's in de 401 regels. Dit **bewijst niet** dat het 401 unieke ondernemingen zijn.
- De lijst is bijna twee maanden oud en moet tegen een actuele officiële directory worden gereconcilieerd.

## Verplichte handmatige/bronmatige uitsplitsing
1. **Dubbele aandelenklassen**: MFE A (`NL0015001OI1`) en MFE B (`NL0015001OJ9`) zijn twee ISIN's van één onderneming. In ondernemingsregister maximaal één bedrijfsrecord; alternatieve klasse apart.
2. **Mogelijke fondsen/investeringsvehikels**: 4AIM SICAF (`IT0005204729`) en 4AIM SICAF COMP 2 (`IT0005440323`) staan in de oude aandelenlijst. Onderzoek en sluit uit indien geen echte operationele onderneming. Een formele aandelennotering is onvoldoende.
3. **Buitenlandse ISIN's, primaire notering nog onbewezen**: ARISTON HOLDING, BREMBO, CAMPARI, CEMENTIR HOLDING, D'AMICO, EUROCOMMERCIAL, FERRARI, IDNTT, IVECO GROUP, MFE A/B, MONDO TV FRANCE, NEUROSOFT, RIBA MUNDO, STELLANTIS, STMICROELECTRONICS, TENARIS. Landcode is geen bewijs voor secundaire notering. Controleer primaire beurs per onderneming, bij voorkeur via officiële IR en beursdossiers.
4. **Secundaire buitenlandse handelssegmenten**: de officiële Borsa Italiana A-Z bevat ook `Global Equity Market` met onder andere Accenture en Amerikaanse aandelen. Deze mogen niet door een brede A-Z scrape in de Milan-catalogus komen.
5. **Marktsegmenten**: STAR is onderdeel van Euronext Milan, niet een afzonderlijke onderneming; Growth Professional apart classificeren. MIV is vooral investeringsvehikels en niet standaard toelaten.

## Bronnen
- https://www.borsaitaliana.it/azioni/mercati/mercati-landingpage/mercati.en.htm
- https://www.borsaitaliana.it/borsa/azioni/listino-a-z.html
- https://www.borsaitaliana.it/borsa/azioni/euronext-growth-milan/lista.html
- https://www.borsaitaliana.it/borsa/azioni/euronext-star-milan/lista.html
- Historische ruwe catalogusbron: https://live.euronext.com/en/product_directory/data/stocks-milan/download?mics=XMIL%2CMTAA%2CEXGM

## Integratiepoort
Geen nieuwe XMIL-contractregel, dagelijkse import, koersbestand, testdeploy of productiepublicatie totdat officiële actuele instrumentenlijst, primaire-notering-bewijs, uitsluitingen, unieke ondernemingen, koersbronproeven en regressietests volledig zijn afgerond. Vervolgens één samenhangende invoering.

## Onafhankelijke officiële ijkpunten (toegevoegd 2026-11-21)
- Borsa Italiana meldde **406 genoteerde ondernemingen per eind maart 2026** over haar aandelenmarkten; dit is een historische ijkwaarde, **geen** actueel goedgekeurd Milaan-aantal: https://www.borsaitaliana.it/azioni/mercati/mercati-landingpage/slidedoc.en.pdf
- Euronext actuele webdirectory meldt **201 instrumenten** voor de gereglementeerde Euronext Milan-lijst: https://live.euronext.com/it/markets/milan/equities/euronext/list
- Euronext actuele webdirectory meldt **234 instrumenten** voor Growth Milan, waaronder warrants/fondsen: https://live.euronext.com/it/markets/milan/equities/growth/list
- Samen **435 instrumentregels**, niet 435 ondernemingen en niet rechtstreeks vergelijkbaar met de 401 historische gefilterde regels. De 34-regels-afwijking is **niet** per onderneming gereconcilieerd.
- Borsa Italiana publiceert maandelijkse statistiek en ondernemingslijsten; deze zijn geschikt als tweede volledigheidscontrole: https://www.borsaitaliana.it/borsaitaliana/statistiche/faq/faq.en.htm
- Het 401-regelige controlebestand staat in `ALL_401_REVIEW.csv`. **398 regels zijn nog niet definitief beoordeeld**; geen import toegestaan.
