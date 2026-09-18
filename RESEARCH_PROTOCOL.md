# KOERSPLEIN — VASTE ONDERZOEKSPROTOCOL v1

## Doel
Test of informatie die op datum T beschikbaar was toekomstige koersdoelen vaker identificeert dan de ongefilterde basiskans en een eenvoudige momentum-baseline.

## Targets
+10%: 3, 6 maanden.
+20%: 3, 6, 9, 12 maanden.
+30%, +50%, +100%: 3, 6, 9, 12, 24 maanden.

Een hit telt zodra een geobserveerde slotkoers na T en uiterlijk op de kalenderhorizon het doel bereikt. Niet alleen de einddatum telt.

## Vaste validatievolgorde
1. Amsterdam (XAMS): discovery.
2. Brussel (XBRU): cross-market validatie.
3. Parijs (XPAR/ALXP/XMLI): blind examen. Parijs mag niet voor tuning worden gebruikt.
4. Volgende ongeziene markt: extra replicatie.

## Nulmetingen
Voor ieder target/horizon wordt de ongefilterde historische hit-rate vastgelegd. Iedere modelspecificatie wordt daarnaast vergeleken met een eenvoudige momentum-baseline.

## Walk-forward
Geen random train/test splits. Training ligt altijd chronologisch vóór validatie. Drempels en modelkeuzes worden uitsluitend op het trainingsdeel bepaald en daarna bevroren.

## Statistische discipline
Rapporteer minimaal: N, geselecteerd N, base rate, hit-rate, lift, Wilson 95%-interval, time-to-hit, max upside en peak-to-trough drawdown.
Meervoudige hypotheses worden gezamenlijk gecorrigeerd. Overlappende horizons worden niet als volledig onafhankelijke observaties behandeld; eindbeoordeling vereist tijd-/aandeel-geclusterde bootstrap of vergelijkbare robuuste toets.

## Promotie
Een model wordt niet gepromoveerd omdat het in-sample goed oogt. Het moet:
- voldoende waarnemingen hebben;
- de ongefilterde nulmeting verslaan;
- de eenvoudige momentum-baseline out-of-sample verslaan als het complexer is;
- de multiple-testing guard doorstaan;
- Brussel doorstaan;
- vervolgens zonder aanpassing het blinde Parijs-examen doorstaan.

## Audit
Voorspellingen zijn frozen. Geen historische selectie wordt stilzwijgend herschreven. Correcties krijgen een expliciete invalidatie-/correctiereden.
