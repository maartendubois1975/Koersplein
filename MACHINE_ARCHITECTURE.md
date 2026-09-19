# KOERSPLEIN — MACHINE-ARCHITECTUUR v3

De Research Director orkestreert tien gespecialiseerde functies. Niet iedere functie hoeft een afzonderlijke service te zijn; de scheiding is methodologisch.

1. M01 Data Truth — point-in-time koers-, corporate-action-, universum- en delistingdata.
2. M02 Opportunity Map — definieert targets, base rates, time-to-hit, drawdown en opportunity sets.
3. M03 Time Machine — reconstrueert exact welke informatie op datum T beschikbaar was.
4. M04 Feature Factory — maakt uitsluitend causale, reproduceerbare features.
5. M05 Model Arena — baselines, modellen, walk-forward, calibratie en ranking.
6. M06 Judge / Statistical Guard — multiple testing, onzekerheid, robuustheid, ablations en reject/promote.
7. M07 Blind World Test — onaangeraakte markten; eerst Parijs, daarna nieuwe markten.
8. M08 Live Opportunity Scanner — frozen modellen op actuele data; ledger en latere scoring.
9. M09 Drift & Execution Monitor — data/model drift, kosten/liquiditeit, delistings, regimewissels en performance decay.
10. M10 Hindsight / Post-Mortem — achteraf extreme stijgingen/crashes analyseren, inclusief externe gebeurtenissen; genereert hypotheses maar mag ze nooit zelf promoveren.

## Ontbrekende datalagen die vóór institutionele conclusies moeten worden toegevoegd
- historische universa inclusief verdwenen/delisted aandelen (survivorship guard);
- splits/dividenden/corporate actions en total-return/adjusted-price consistentie;
- point-in-time fundamentals en earnings/guidance;
- tijdgestempelde nieuws- en eventlaag;
- sector/index/factor benchmarks voor abnormal returns;
- macro/rente/inflatie/FX/grondstoffen;
- liquiditeit, spread en uitvoeringskosten;
- bron/provenance en revisiehistorie.

## Hindsight-regel
M10 mag achteraf alles zien om verklaringen en nieuwe hypothesen te vinden. Elke gevonden factor krijgt één label: PRE_VISIBLE, SURPRISE_EVENT, HINDSIGHT_ONLY of CONFOUNDED. Alleen PRE_VISIBLE mag als kandidaat-feature terug naar M03/M04. Daarna moet M05 de hypothese volledig opnieuw point-in-time testen op Amsterdam/Brussel. Parijs blijft blind en wordt niet gebruikt voor feature discovery.
