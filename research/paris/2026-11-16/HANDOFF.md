# Kopieerbare overdracht — Koersplein Parijs

Repository: maartendubois1975/Koersplein
Branch: paris-reset-20261116
Onderzoeksdatum: 16 november 2026
Uitgangscommit: 9b9e20eb521972c2256559150eb5967dec535aea
Onderzoekscommit: de commit die dit dossier toevoegt; de exacte SHA wordt bij de overdracht in de chat vermeld.

Het bestaande onderzoek is hergebruikt: inventarisrun 43809738322 / commit 2777828afd74d286539067c71c1024698730df00 en beslisreviewrun 43810891249 / commit 9b9e20eb521972c2256559150eb5967dec535aea. Beide oorspronkelijke artifacts zijn ongewijzigd en met geverifieerde SHA-256 in de branch bewaard.

Centrale bron van waarheid:
research/paris/2026-11-16/company-decisions.json

Alle 769 oorspronkelijke noteringen hebben een afzonderlijke beslissing, reden, bronnen en historische toestand:
- XPAR: 295 opnemen, 37 uitsluiten, 5 apart.
- ALXP: 246 opnemen, 44 uitsluiten, 3 apart.
- XMLI: 123 opnemen, 7 uitsluiten, 9 apart.
- Totaal: 664 opnemen, 88 uitsluiten, 17 apart.

De 664 vormen de onderbouwde onderzoeksselectie, niet de claim dat alle onzekerheid over het totale universum is verdwenen. Hoofdmarktconclusies die uit de bronnen worden afgeleid, staan expliciet als inference gemarkeerd. Niet iedere conclusie berust op een rechtstreeks uitgelezen Market-of-Reference-masterveld. Stel de 17 open gevallen niet alsnog zonder aanvullend bewijs gelijk aan goedgekeurde bedrijven.

De brede officiële directory bevat 771 handelsregels met dezelfde 769 unieke ISIN's. De twee extra regels zijn Accor USD en Eiffage USD: dubbele valutalijnen, geen ontbrekende bedrijven. Deze zijn apart uitgesloten. De oude broncatalogus had 770 regels; het verschil bevat acht toevoegingen, negen vervallen oude identiteiten en vijf naam-/tickerwijzigingen. D.A.T.E. en N4 Group zijn nieuwe beursgangen.

88 uitsluitingen: 42 rechten/warrants, 15 aandelencertificaten, 1 SES FDR, 2 tweede aandelenklassen, 25 andere hoofdmarkten en 3 expliciet beëindigde/liquiderende ondernemingen. Altamir, echte holdings, vastgoedbedrijven en buitenlandse ondernemingen met onderbouwde Parijse hoofdnotering worden niet op die kenmerken uitgesloten.

17 open gevallen: AKOM, MLALV, MLASO, MLCOR, MLDYN, MLEAV, ALEUA, MLGNS, ALKLN, MLMGL, MLMIB, SLCO, ALIE, STLAP, STMPA, MLTRO en CV. Zie pending-cases.csv voor individuele redenen en bronnen.

Historie:
- De oude audit meldde 744 noteringen en 3.316.652 regels. Deze data zijn niet verwijderd of overschreven.
- Voor de 664 geselecteerde bedrijven: 632 exacte opslagidentiteiten met gemelde historie, 17 oude koppelingen in quarantaine, 13 ontbrekende gewone huidige identiteiten en 2 ontbrekende nieuwe ISIN-identiteiten.
- Manifestaanwezigheid is geen volledige koers-/OHLC-validatie.
- Alle 28 oude reeksen zijn daadwerkelijk gelezen. 27 hebben een afwijkende beurscode. 18 Spaanse reeksen bevatten één regel met open=0 en volume=0. Negen andere reeksen bevatten meerdere bars onder afwijkende beursidentiteiten. De laatste oude reeks is Lepermislibre DS, een inschrijvingsrecht.
- Ontbrekende huidige identiteiten: ALALO, MLBIM, ALDAT, MLESV, MLEXX, MLGL, MLHA2, MLIME, MLKPS, MLMED, ALN4, ALPRG, MLSJA, MLURC en MLVIC.
- Acheter-Louer.fr: FR0014011O84 → FR001401B5X2, ingang 10-11-2026, 10.000 oude aandelen per nieuw aandeel.
- Prologue: FR0010380626 → FR001401AOZ5, ingang 15-10-2026, 100 oude aandelen per nieuw aandeel. Acht bars vanaf die datum staan nog onder de oude beursgebonden opslagidentiteit. Eerst bron en gebeurtenisgrens onderzoeken; geen automatische samenvoeging of prijsaanpassing.

Belangrijke bestanden onder research/paris/2026-11-16/:
README.md, company-decisions.json, included-companies.csv, excluded-listings.csv, pending-cases.csv, all-listings.csv, approved-research-catalog.json, summary.json, validation.json en evidence/.

Export-/controleprogramma:
scripts/research/export-paris-company-review.mjs

Geslaagde controles:
node scripts/research/export-paris-company-review.mjs --check
npm run history:core:test

De centrale registercontrole verifieert alle 769 beslissingen en bronrelaties, uniciteit en segmentaantallen, afgeleide bestanden, 28 werkelijk gelezen bar-aantallen en de bestaande exacte 80/105-identiteiten. Runtimecatalogi zijn met hashes als ongewijzigd gecontroleerd. Geen nieuwe CI-run, Render-uitrol, databasewijziging of productiepublicatie uitgevoerd.

Volgende technische bouwblok:
1. Sluit alleen de INCLUDE-selectie gecontroleerd aan op het bestaande company-register-contract en de bestaande providerroutering; creëer geen tweede handmatig onderhouden register.
2. Houd de 17 open gevallen apart en niet importeerbaar.
3. Hergebruik storage-identity.mjs en herstel de historische identiteitscontracten, oude afwijkende beurscodes en twee ISIN-gebeurtenissen met behoud van alle ruwe data.
4. Herzie het bestaande Paris existing-history-only-beleid: dat bewijst geen bedrijfsactiviteit en sluit nieuwe identiteiten buiten de dagelijkse import.
5. Los ontbrekende huidige historie en bronkwaliteit op, met scheiding van echte OHLC-transacties en referentie-/waarderingssluitingen.
6. Valideer daarna in één samenhangend blok register → bron → opslag → manifest/API → testwebsite, inclusief actuele openings-/slotdatums en Render-branchcontrole.

Amsterdam, Brussel, overige Europese markten en productie blijven ongemoeid. Begin niet opnieuw met de 769-identiteiteninventaris; werk vanuit dit dossier en leg uitsluitend nieuw bewijs of technische wijzigingen vast.
