# Koersplein — onderzoeksmodel voor de voorspelmachine

Dit document legt de uitgangspunten vast die vóór de bouw van de voorspelmachine zijn besproken. Het is een groeiend onderzoeksdocument: nieuwe hypotheses worden toegevoegd, maar pas na historische toetsing als bruikbaar signaal behandeld.

## Doel
Koersplein onderzoekt welke aandelen of combinaties van aandelen binnen 3, 6, 12 of 24 maanden een gekozen rendement kunnen halen. Amsterdam is het eerste historische laboratorium; daarna Europa en vervolgens de wereld.

## Kernregel: historische tijdmachine
Voor iedere historische voorspeldatum mag het model uitsluitend informatie gebruiken die op die datum daadwerkelijk bekend was. Daarna wordt de echte toekomst geopend en wordt voorspelling versus werkelijkheid gemeten. Vervolgens mag een aparte achteraf-analyse onderzoeken welke gebeurtenissen en factoren de uitkomst waarschijnlijk hebben beïnvloed. Ontdekte patronen moeten opnieuw out-of-sample worden getest voordat ze voorspellend gewicht krijgen.

## Informatielagen
1. Aandeel/bedrijf: OHLCV, volatiliteit, momentum, drawdown, omzet, winst, marges, kasstroom, schuld, dividend, buybacks, waardering, verwachtingen en revisions.
2. Sector/keten: concurrenten, leveranciers, klanten, sectorindices, grondstoffen en informatie-overdracht tussen prominente en minder gevolgde aandelen.
3. Land: groei, inflatie, arbeidsmarkt, vertrouwen, begroting, belastingen, verkiezingen, nationale beleidsmomenten (Nederland o.a. Prinsjesdag) en economische verrassingen versus consensus.
4. Europa/regio: ECB, rente, euro, energie, EU-beleid, Europese conjunctuur en regionale sectorfactoren.
5. Wereld: Fed, Amerikaanse macrodata, dollar, obligatierentes, VIX/risk appetite, olie/gas/goud, China, handel, oorlog/geopolitiek en mondiale financiële cyclus.
6. Nieuws/informatie: onderwerp, sentiment, verrassing, nieuwheid versus herhaling, aandacht, intensiteit en bron.
7. Kalender/events: cijfers, guidance, ex-dividend, indexwijzigingen, centrale-bankbesluiten, macropublicaties, verkiezingen en andere vooraf bekende events.
8. Marktbrede vraag/aanbod en systematische beweging: meten waarom veel aandelen tegelijk stijgen of dalen, los van de kwaliteit van één bedrijf.

## Marktbrede beweging — expliciet onderzoeksobject
Koersplein moet iedere handelsdag de totale marktbeweging ontleden. Niet alleen vragen waarom ASML of ING bewoog, maar eerst: was dit vooral een bedrijfsdag, sectordag, Amsterdamdag, Europadag of werelddag?

Te meten marktbrede signalen:
- AEX/AMX/AScX en brede Amsterdamse marktreturn;
- breadth: percentage stijgers/dalers, aantal nieuwe highs/lows en spreiding van rendementen;
- volume en abnormaal volume;
- correlatie/co-movement tussen aandelen en sectoren;
- volatiliteit en veranderingen in volatiliteit;
- rente en rentecurve;
- EUR/USD en relevante valuta;
- grondstoffen/energie;
- Europese en Amerikaanse indexbewegingen;
- VIX/risk appetite en kredietspreads waar beschikbaar;
- ETF/index/fondsstromen en andere bruikbare flow-/liquiditeitsindicatoren waar historische data/licenties dit toelaten;
- macro-economische verrassingen versus marktverwachting;
- centrale-bankcommunicatie en rentebesluiten;
- geopolitieke/politieke gebeurtenissen;
- nieuwsvolume, sentiment, nieuwheid en beleggersaandacht.

## Belangrijk onderscheid
Een aandeelrendement wordt conceptueel ontleed in meerdere lagen:
- wereldfactor;
- regiofactor;
- land/markt-factor;
- sectorfactor;
- bedrijfsfactor;
- tijdelijke flow/liquiditeit/sentimentfactor;
- onverklaarde rest.

Daarmee kan dezelfde bedrijfsinformatie anders worden gewogen afhankelijk van het marktregime. Een goed bedrijf kan op een risk-off dag dalen; een zwak bedrijf kan op een sterke risk-on dag stijgen. De machine moet beide krachten tegelijk modelleren.

## Marktregimes
Historische perioden worden geclassificeerd op o.a. bull/bear, hoge/lage rente, stijgende/dalende rente, hoge/lage inflatie, hoge/lage volatiliteit, crisis/herstel, risk-on/risk-off en liquiditeitsstress. Een signaal dat in één regime werkt, mag niet automatisch universeel worden verklaard.

## Modellen laten concurreren
Koersplein test afzonderlijke en gecombineerde modellen voor koers/techniek, fundamentals, macro, sector/netwerk, nieuws/sentiment/aandacht en marktbrede/systematische factoren. Per aandeel, sector, horizon en regime wordt gemeten welke combinatie historisch werkelijk voorspellende waarde had.

## Portefeuilles
Niet alleen losse aandelen voorspellen. Voor een gekozen doel (bijv. 12 maanden, minimaal +20%, vier aandelen) ook combinaties testen op verwachte opbrengst, kansverdeling, drawdown, correlatie en gedeelde risicofactoren. Vier aantrekkelijke aandelen met dezelfde systematische blootstelling zijn geen echte spreiding.

## Onderzoeksbibliotheek
Bouw een permanente Koersplein Research Library van wetenschappelijke papers, boeken/hoofdstukken waar legaal toegankelijk, centrale-bankonderzoek, universiteitsonderzoek en relevante marktstudies. Per bron structureren: factor/hypothese, markt/land, periode, horizon, methode, effect, robuustheid, out-of-sample resultaat, replicatie/tegenbewijs en toepasbaarheid op Koersplein.

## Hoofdprincipe
Literatuur levert hypotheses, geen waarheid. Iedere factor moet door de historische Amsterdamse tijdmachine worden bewezen. Daarna pas krijgt hij gewicht in de voorspelmachine. Later wordt getest welke patronen universeel zijn en welke alleen gelden voor een land, sector, aandeel, horizon of marktregime.
