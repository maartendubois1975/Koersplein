# Koersplein — Research Governance & Register

Dit document is de blijvende bron van waarheid voor afspraken over de Koersplein-onderzoeksmachine. Een afspraak uit chat is pas technisch actief als de status dat bewijst.

## Verplichte statusketen
Iedere inhoudelijke onderzoeksbeslissing krijgt één van deze statussen:

1. **BESPROKEN** — inhoudelijk overeengekomen, nog niet formeel gespecificeerd.
2. **VASTGELEGD** — opgenomen in GitHub-specificatie/register met acceptatiecriteria.
3. **GEBOUWD** — code/job/schema bestaat op een branch/PR.
4. **GETEST** — tests en/of gecontroleerde run bewijzen dat de implementatie werkt.
5. **ACTIEF** — gemerged en daadwerkelijk beschikbaar voor de bedoelde productie-/onderzoeksrun.

Nooit "ingesteld", "klaar" of "draait" zeggen wanneer de feitelijke status lager is.

## Werkwijze voor nieuwe beslissingen
Bij iedere nieuwe of gewijzigde onderzoeksafspraak:
- controleer eerst dit register en gekoppelde issues/code;
- voeg de beslissing toe of wijzig de bestaande entry;
- leg doel, scope, datavereisten, point-in-time-regels en acceptatiecriteria vast;
- koppel issue/PR/commit/job waar van toepassing;
- wijzig status alleen op basis van bewijs;
- voorkom duplicaten: één canonieke entry per onderzoeksvraag;
- onderzoeksresultaten horen in D1/R2/artifacts, niet als grote hoeveelheden Git-commits.

## Centrale onderzoeksarchitectuur
Canonieke specificatie: GitHub Issue #48 — Research Factory v1.

### RF-001 Historische trefkans / base rate
**Status: VASTGELEGD**
Per aandeel en historisch startpunt meten hoe vaak configureerbare koersdoelen (+10/+20/+30/+40/+50%) binnen 1/3/6/12/24 maanden worden geraakt; inclusief eindrendement, time-to-target, MFE en MAE/drawdown. Uitsplitsen naar aandeel, sector, markt en regime.

### RF-002 Machine 1 — blind point-in-time
**Status: VASTGELEGD**
Historische cutoff T: uitsluitend informatie gebruiken die aantoonbaar op/before T beschikbaar was. Forecast en feature snapshot bevriezen vóór toekomst wordt geopend.

### RF-003 Forward outcome scorer
**Status: VASTGELEGD**
Na bevroren forecast werkelijkheid openen: rendement, target hit, datum, MFE/MAE, richting, calibratie, false positives/negatives en excess return meten.

### RF-004 Machine 2 — hindsight diagnostics
**Status: VASTGELEGD**
Met kennis van de uitkomst onderzoeken welke vóór cutoff bestaande signalen Machine 1 miste, verkeerd woog of ten onrechte belangrijk vond. Uitkomst is kandidaat-hypothese, nooit automatische productieregel.

### RF-005 Leer- en promotielus
**Status: VASTGELEGD**
Kandidaatverbetering -> training -> chronologische validatie -> nieuwe ongeziene blinde out-of-sample test. Alleen generaliserende verbeteringen promoveren.

### RF-006 Externe signalen
**Status: VASTGELEGD**
Point-in-time onderzoek van o.a. rente, inflatie, valuta, grondstoffen, krediet, geopolitieke gebeurtenissen/oorlog, sancties, regelgeving/beleid, supply chain, overnames, management, product- en sectorontwikkelingen. Bewaar bron- en publicatietijd.

### RF-007 Bias/leakage-beveiliging
**Status: VASTGELEGD**
Look-ahead, survivorship bias, revisiedata, corporate actions, multiple testing, cherry-picking en overfitting expliciet bewaken.

### RF-008 Robustheid
**Status: VASTGELEGD**
Walk-forward, bull/bear/sideways, volatiliteitsregimes, sector/markt-transfer, ablation, missing-data stress en eenvoudige baselines.

### RF-009 Parijs laboratorium
**Status: VASTGELEGD**
Volgorde: base rates -> cutoff-set -> Machine 1 -> scorer -> Machine 2 -> lessen -> nieuwe ongeziene Parijse blinde test -> validatierapport. Geen leren op Amsterdam/Brussel vóór deze gate technisch bewezen is.

### RF-010 Drie-marktenonderzoek
**Status: VASTGELEGD**
Na Parijs-gate dezelfde cyclus uitvoeren over Parijs + Amsterdam + Brussel en expliciet cross-market/sector generalisatie meten.

### RF-011 Doorlopende actuele onderzoeksmachine
**Status: VASTGELEGD**
Actuele kandidaat toont horizon/target, base rate, conditionele hit rate, sample size, calibratie/onzekerheid, positieve én negatieve signalen en historische vergelijkingsgevallen. Geen rendementsgarantie.

### RF-012 Automatische research jobs
**Status: VASTGELEGD**
Te integreren in bestaande D1/R2/Worker/factory, minimaal: BUILD_BASE_RATES, BUILD_POINT_IN_TIME_FEATURES, RUN_BLIND_RESEARCH, SCORE_FORWARD_OUTCOMES, RUN_HINDSIGHT_DIAGNOSTICS, VALIDATE_RESEARCH, PROMOTE_RESEARCH_VERSION. Idempotent, resumable, checkpoints, foutisolatie, audit trail en versiebeheer.

### RF-013 Verplichte menselijke onderzoeksconclusie + site-output
**Status: VASTGELEGD**
Iedere voltooide onderzoeksrun moet naast machine-artifacts ook een begrijpelijke conclusie opleveren voor de eigenaar én een gestructureerde versie voor de site. Geen run geldt als afgerond zonder dit eindrapport.

Het eindrapport bevat minimaal:
- wat is onderzocht, universum, periode, horizons en aantal observaties;
- historische base rates per target/horizon;
- welke signalen aantoonbaar waarde toevoegden en welke niet;
- sterkste positieve én negatieve bevindingen;
- false positives, false negatives en belangrijke missers;
- verschillen tussen Machine 1 en Machine 2;
- welke hindsight-lessen nieuwe blinde out-of-sample tests overleefden;
- prestaties versus simpele baselines;
- beperkingen, datagaten, onzekerheid en risico op overfitting;
- concrete conclusie in gewone Nederlandse taal: **wat hebben wij hiervan geleerd?**;
- welke onderzoeksregels/features worden behouden, verworpen of opnieuw getest;
- site-contract met alleen gevalideerde resultaten, inclusief evidence/sample size/base rate/onzekerheid en datum/model/data/feature-versie.

De website mag geen conclusie publiceren die niet herleidbaar is tot een gevalideerde onderzoeksrun. De menselijke conclusie moet leesbaar blijven naast de technische JSON/artifacts, zodat de eigenaar zelf van elke onderzoeksronde kan leren.

## Fase-gate
Huidige opdracht: **eerst Parijs**. De Research Factory mag pas als Parijs-lab "GETEST/ACTIEF" worden aangemerkt wanneer point-in-time/leakage-controles, base rates, blind/hindsight/out-of-sample cyclus en validatierapport aantoonbaar slagen. Daarna pas Parijs + Amsterdam + Brussel.

## Rapportageregel
Bij statusvragen altijd rapporteren op basis van GitHub/code/job-bewijs en expliciet aangeven: VASTGELEGD, GEBOUWD, GETEST of ACTIEF. Chatgeheugen alleen is nooit bewijs van implementatie.
