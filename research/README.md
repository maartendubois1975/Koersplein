# Koersplein Research Machine

De Research Machine onderzoekt welke signalen aantoonbaar voorspellende waarde hebben voor 3, 6, 12 en 24 maanden. Amsterdam (XAMS) is het eerste laboratorium.

## Vaste onderzoeksvolgorde
1. Idee of literatuur vastleggen als hypothese.
2. Exact bepalen welke informatie op historisch tijdstip t beschikbaar was.
3. Machine 1 voert een blinde walk-forward test uit en bevriest de voorspelling.
4. Pas daarna worden de gerealiseerde uitkomsten geopend en gescoord.
5. Machine 2 mag vervolgens met volledige latere kennis verklaren waarom Machine 1 goed of fout zat.
6. Nieuwe inzichten uit Machine 2 moeten opnieuw blind op ongeziene perioden/markten worden getest.

## Eerste actieve run
`XAMS-M1-BASELINE-001` is de eerste technische nulmeting. Deze gebruikt uitsluitend historische prijsinformatie die op ieder meetmoment beschikbaar was. Nog niet ingelezen point-in-time fundamentals, analistenrevisies, nieuws/sentiment, macro, flows, opties en shortdata worden expliciet als ontbrekend opgeslagen; de machine verzint hiervoor geen waarden.

Deze nulmeting is niet het uiteindelijke voorspelmodel. Zij valideert de volledige historische tijdmachine, maandelijkse snapshots, horizons 3/6/12/24 en de scheiding tussen voorspelling en latere uitkomst. Uitvoering gebeurt los van de Belgische koersvulling en veroorzaakt geen website-deploy.
