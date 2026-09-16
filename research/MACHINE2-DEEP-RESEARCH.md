# Machine 2 — historische detective

Doel: verklaren waarom bevroren Machine 1 voorspellingen goed of fout waren, zonder Machine 1 ooit te herschrijven en zonder achterafkennis als historisch beschikbaar signaal te behandelen.

## Tijdmodel
Elke observatie bewaart minimaal: `valid_time` (waar de informatie economisch over gaat), `published_time` (eerste publieke timestamp), `tradable_time` (eerste realistische handelstijd), `retrieved_time`, bron, bronversie/hash en eventuele latere revisies. Machine 2 mag de toekomst zien voor diagnose, maar een kandidaat-signaal krijgt alleen `KNOWN_AT_T=true` wanneer bewijs toont dat `tradable_time <= prediction_time`.

## Signaalfamilies
PRICE, TRADING, FUNDAMENTALS, FUND_CHANGE, VALUATION, EXPECTATIONS, MANAGEMENT, NETWORK, SECTOR, MARKET_AMSTERDAM, EUROPE, GLOBAL, RATES, INFLATION, FX, COMMODITIES, CREDIT, RISK_VOLATILITY, FLOWS, INDEX_EFFECTS, NEWS, ATTENTION_SEARCH_SOCIAL, POLITICS_POLICY, CENTRAL_BANKS, GEOPOLITICS, CALENDAR, SMART_MONEY, SHORT, OPTIONS, CORRELATION_CONTAGION, REGIME, EVENT_REACTION, RELATIVE, INTERACTIONS.

## Per historisch voorspellingmoment
1. Neem de bevroren voorspelling, horizon en confidence uit Machine 1.
2. Leg de werkelijkheid vast op +1d, +1w, +1m, +3m, +6m, +12m en +24m waar beschikbaar.
3. Bouw een dossier van informatie die vóór T aantoonbaar beschikbaar was.
4. Bouw apart een toekomst-dossier van gebeurtenissen ná T.
5. Classificeer elk gevonden signaal: KNOWN_AT_T, NOT_KNOWN_AT_T, UNCERTAIN_TIMESTAMP of UNAVAILABLE.
6. Zoek mogelijke oorzaken van fout/goede voorspelling: gemist signaal, verkeerd gewicht, regimebreuk, onverwachte gebeurtenis, sector/markt besmetting, liquiditeit, corporate action of ruis.
7. Maak uitsluitend kandidaat-hypotheses. Geen kandidaat krijgt automatisch gewicht in Machine 1.

## Databronlagen
- officiële bedrijfsfilings, jaar/halfjaar/kwartaalberichten, trading updates, corporate actions;
- historische fundamentals en veranderingen daarin;
- historische consensus, earnings/revenue estimates, target/recommendation revisions indien rechtmatig beschikbaar;
- prijs, volume, volatiliteit, drawdown, momentum, gaps, relatieve sterkte en liquiditeit;
- sector-, index-, Europese en wereldmarktcontext;
- rente, yield curve, inflatie, FX, grondstoffen, krediet en volatiliteitsindices;
- nieuws met originele publicatietijd; bedrijfs-, sector- en macro-events;
- managementwissels, insider/major-holder disclosures waar beschikbaar;
- short interest/short disclosures, flows, ETF/indexwijzigingen;
- opties/implied volatility/skew waar historisch en rechtmatig beschikbaar;
- aandacht: zoek/social/public interest alleen met historische timestamp en reproduceerbare bron;
- politiek, regelgeving, centrale banken en geopolitiek als gedateerde events;
- cross-asset/correlation/regime en lead-lag relaties.

## Bronprioriteit
Officiële primaire bron > gereguleerde filing/exchange > centrale bank/statistiekbureau > hoogwaardige historische databron > nieuwsarchief > overige webbron. Een bron zonder betrouwbare publicatietijd mag geen KNOWN_AT_T bewijs leveren.

## Biasbeveiliging
- geen restated/latest fundamentals vóór hun echte publicatiedatum;
- reporting lag respecteren;
- originele en herziene waarden naast elkaar bewaren;
- survivorship: later verdwenen/delisted namen niet stil verwijderen;
- historische indexsamenstelling gebruiken waar relevant;
- corporate actions expliciet verwerken;
- geen LLM-geheugen als historisch bewijs: elke feitelijke claim vereist gedateerde bron;
- geen tuning op dezelfde observaties waarop een hypothese is ontdekt;
- hypotheses uit Machine 2 gaan naar een evidence gate en daarna naar untouched/out-of-sample blinde tests;
- multiple-testing/FDR en effectstabiliteit per tijdvak, aandeel, sector en regime rapporteren.

## Analyse-output
Per signaalfamilie: coverage, sample size, directionele lift versus baseline, effectgrootte, horizon, regime/sector stabiliteit, confidence interval waar mogelijk, missingness, timestampkwaliteit, bronkwaliteit, multiple-testing status en OOS-status. Bewaar ook mislukte hypotheses.

## Schaalstrategie
Niet 24.528 dossiers tegelijk via web zoeken. Dedupliceer informatie per bedrijf/datum/event en hergebruik hetzelfde point-in-time event voor alle relevante voorspellingen. Werk in batches met checkpoints/resume, caching, bron-rate-limits, foutisolatie en budgetlimieten. Eerst Amsterdam volledig; daarna dezelfde generieke machine per markt.

## Eindregel
Machine 2 verklaart en ontdekt. Alleen een later opnieuw blind bewezen signaal mag Machine 1 beïnvloeden.