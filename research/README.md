# Koersplein Research Machine

Amsterdam (XAMS) is het eerste laboratorium. De machine onderzoekt welke signalen aantoonbaar voorspellende waarde hebben voor 3, 6, 12 en 24 maanden.

Vaste volgorde: hypothese vastleggen → point-in-time informatie bepalen → Machine 1 blind walk-forward laten draaien en voorspelling bevriezen → gerealiseerde uitkomst openen en scoren → Machine 2 achteraf oorzaken onderzoeken → nieuwe inzichten opnieuw blind op ongeziene data testen.

De eerste actieve run `XAMS-M1-BASELINE-001` is bewust een nulmeting met uitsluitend historische prijsinformatie. Niet-ingelezen point-in-time fundamentals, analistenrevisies, nieuws/sentiment, macro, flows, opties en shortdata blijven expliciet ontbrekend. Er worden geen waarden verzonnen.

Deze nulmeting is geen productvoorspelling en geen eindmodel. Zij valideert de historische tijdmachine, maandelijkse snapshots, horizons 3/6/12/24 en de harde scheiding tussen informatie die toen bekend was en wat later werkelijk gebeurde. De run staat los van de Belgische koersvulling en veroorzaakt geen website-deploy.
