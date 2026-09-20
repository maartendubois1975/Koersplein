# Paris Research Factory v1

## Uitvoerbare volgorde
De pipeline is strikt sequentieel en hervatbaar:
1. BUILD_BASE_RATES
2. BUILD_POINT_IN_TIME_FEATURES
3. RUN_BLIND_RESEARCH
4. SCORE_FORWARD_OUTCOMES
5. RUN_HINDSIGHT_DIAGNOSTICS
6. VALIDATE_RESEARCH
7. BUILD_HUMAN_CONCLUSION
8. BUILD_SITE_RESEARCH_OUTPUT
9. PROMOTE_RESEARCH_VERSION

Iedere stap schrijft een manifest met input/data/feature/model-version, cutoff-regels, aantallen, fouten en checkpoint. Een volgende stap mag alleen starten wanneer de vorige gate PASS is.

## Parijs eerst
market=PARIS is de enige toegestane markt in fase A. Amsterdam en Brussel mogen niet in training, feature-selectie of validatie terechtkomen. Pas na PROMOTE_RESEARCH_VERSION en expliciete drie-marktenvrijgave wordt fase B toegestaan.

## Tijdmachine
Voor iedere cutoff T geldt available_at <= T. Event time is niet genoeg: publicatie-/beschikbaarheidstijd is leidend. Revisions krijgen eigen available_at. Features worden als immutable snapshot opgeslagen. Forward outcomes worden pas na het bevriezen van de forecast gekoppeld.

## Nulmeting
Horizons: 1m,3m,6m,12m,24m. Targets configureerbaar, standaard +10,+20,+30,+40,+50%. Meet close-to-close forward return, intraperiod target-hit, time-to-target, MFE en MAE. Rapporteer aandeel/sector/markt/regime base rates en sample sizes.

## Blind -> waarheid -> hindsight -> opnieuw blind
Machine 1 krijgt alleen point-in-time snapshots. Scorer koppelt daarna uitkomsten. Machine 2 gebruikt de uitkomst alleen voor diagnose/hypotheses. Kandidaten worden nooit direct gepromoveerd: ze moeten op een chronologisch latere, ongeziene holdout opnieuw blind slagen.

## Verplichte einduitslag
Geen run is COMPLETED zonder twee outputs:
- human_conclusion.md/json: begrijpelijke Nederlandse conclusie met wat geleerd is, wat werkte/niet werkte, fouten, onzekerheid, datagaten, overfitrisico en behouden/verworpen/herte-testen lessen.
- site_research_output.json: alleen gevalideerde claims met horizon, target, base_rate, conditional_hit_rate, sample_size, calibration/uncertainty, positieve/negatieve signalen, evidence refs en versies.

De site mag alleen output met validation_status=PASS en promoted=true tonen.

## Gate
FAIL bij leakage, ontbrekende provenance/available_at voor gebruikte niet-koersfeatures, onvoldoende holdout, niet-reproduceerbare run of ontbrekende menselijke conclusie.