# Koersplein — consolidatie op 17 november 2026

Werkbranch: `consolidation-20261116`. Startcommit: `43999b80d0dabc36c93d6bd2939c8cc5484a0596`, met de vier al uitgevoerde wijzigingen. Deze verbeteringen zijn behouden en uitgebreid. Er is geen productiebranch gewijzigd en geen deployment uitgevoerd.

## 1. Daadwerkelijk aangepast en verwijderd

30 bestanden verwijderd, 26 bestaande bestanden aangepast en 14 bestanden toegevoegd (vier workflow/testbestanden en tien documentatie-/bewijsbestanden). Netto **736 regels minder uitvoerbare programmering en configuratie**, inclusief de nieuwe tests. De volledige lijst met blob-hashes staat in `research/consolidation/2026-11-17/changed-files.json`.

De centrale contracten en goedgekeurde selecties blijven exact gelijk: Amsterdam **80**, Brussel **105**, Parijs **664**, totaal **849**. Parijs omvat 295 XPAR, 246 ALXP en 123 XMLI.

Aangepaste programmabestanden:

- `.github/workflows/approved-daily-session.yml`
- `daily-session-view.mjs`
- `package.json`
- `scripts/audit/architecture-inventory.mjs`
- `scripts/audit/codebase-audit.mjs`
- `scripts/cloudflare/approved-daily-session.mjs`
- `scripts/cloudflare/archive-approved-session.mjs`
- `scripts/cloudflare/audit-daily-open-close.mjs`
- `scripts/cloudflare/test-europe-missing-backfill-priority.mjs`
- `scripts/cloudflare/test-europe-ohlc-integrity.mjs`
- `scripts/cloudflare/test-europe-provider-routing.mjs`
- `scripts/cloudflare/test-import-session-boundary.mjs`
- `scripts/history.mjs`
- `scripts/history/company-register.mjs`
- `scripts/research/analytics.mjs`
- `scripts/research/daily-opportunity-ledger.mjs`
- `scripts/research/exam-outcomes-core.mjs`
- `scripts/research/independent-market-judge.mjs`
- `scripts/research/market-history-source.mjs`
- `scripts/research/prediction-ledger-core.mjs`
- `scripts/research/research-quality.mjs`
- `scripts/research/universal-market-machine1.mjs`
- `scripts/server.mjs`
- `share.js`

Nieuwe regressiecontrole en tests:

- `.github/workflows/approved-regression-check.yml`
- `scripts/history/test-approved-pipeline.mjs`
- `scripts/history/test-approved-market-view.mjs`
- `scripts/research/test-opportunity-boundaries.mjs`

Bijgewerkt: dit rapport, `docs/CLEAN_ARCHITECTURE.md` en `docs/AMSTERDAM_EXECUTION_STATE.md`. Nieuw onderzoeksbewijs staat uitsluitend in `research/consolidation/2026-11-17/`.

Verwijderd na controle van imports, npm-opdrachten, workflows en uitvoerbare afhankelijkheden:

- `.github/workflows/paris-evidence-review.yml`
- `.github/workflows/paris-full-history-audit.yml`
- `.github/workflows/paris-inventory-audit.yml`
- `.github/workflows/paris-recovery-evidence.yml`
- `.github/workflows/paris-register-check.yml`
- `.github/workflows/paris-stage-recovery.yml`
- `.github/workflows/paris-storage-plan.yml`
- `.github/workflows/xams-regression-check.yml`
- `config/paris-follow-policy.json`
- `config/research/paris-v1.json`
- `scripts/cloudflare/daily-open-close-update.mjs`
- `scripts/cloudflare/paris-active-universe.mjs`
- `scripts/cloudflare/paris-history-eligibility.mjs`
- `scripts/cloudflare/paris-targeted-history-recovery.mjs`
- `scripts/cloudflare/reconcile-official-daily.mjs`
- `scripts/cloudflare/test-paris-history-eligibility.mjs`
- `scripts/cloudflare/universal-market-runner.mjs`
- `scripts/history/amsterdam-daily-run.mjs`
- `scripts/research/amsterdam-machine1.mjs`
- `scripts/research/brussels-machine1.mjs`
- `scripts/research/build-paris-snapshot.mjs`
- `scripts/research/paris-input.mjs`
- `scripts/research/paris-machine1.mjs`
- `scripts/research/paris-pipeline.mjs`
- `scripts/research/paris-universe.mjs`
- `scripts/research/run-paris-core.mjs`
- `scripts/research/run-paris-full.mjs`
- `scripts/research/test-paris-input.mjs`
- `scripts/research/test-paris-pipeline.mjs`
- `scripts/research/test-paris-universe.mjs`

De oude Parijse Actions-wrappers verwezen naar afgeronde onderzoeksfasen en oudere run-ID’s. De brononderzoeken, afzonderlijke auditprogramma’s, opgeslagen onderzoeksresultaten, ISIN-bewijzen en Git-historie zijn behouden. De Amsterdamse kwaliteits- en provenancecontroles zijn eveneens behouden.

## 2. Welke dubbele systemen verdwenen

De aanvullende Europese dagelijkse schrijver, reconciliatieschrijver, Amsterdamse dagelijkse orkestrator en oude ruwe-catalogusschrijver zijn verwijderd. `npm run history:update` gebruikt dezelfde goedgekeurde collector en archiver als de dagelijkse workflow. Historische backfill en brononderzoek blijven afzonderlijke onderhoudstaken.

De aparte Amsterdamse, Brusselse en Parijse Machine 1-programma’s zijn vervangen door de bestaande universele onderzoeksrunner. De Parijse selectie op ‘heeft al historie’ is verdwenen: ieder goedgekeurd bedrijf krijgt dagelijkse broncontrole, ook zonder oude koersreeks. Zeven historische Parijse workflows en de Amsterdamse regressieworkflow zijn vervangen door één Europese regressieworkflow naast de centrale dagworkflow. Er zijn op deze branch twee workflows over.

`data/company-register-contracts.json` bepaalt alle goedgekeurde universums, aantallen en identiteitsdigests. Dagverwerking en onderzoek leiden hun markten daarvan af. Per-beurs fouten blokkeren andere beurzen niet. De archiver bewaart eerst de koersen; de daaropvolgende onderzoeksjob kan die archivering niet tegenhouden.

Nieuwe daghistorie gebruikt het bestaande documentformaat `instrument + coverage + bars`, met opslagidentiteit `<werkelijke MIC>:<officiële ISIN>`. Alle oude lokale en Cloudflare-reeksen blijven bestaan als read-only compatibiliteitsbronnen. Dit is geen voltooide fysieke migratie van alle bestaande Cloudflare-partities naar Git. De website combineert de nieuwe dagstaart met de oude gecontroleerde identiteit; een korte nieuwe reeks verdringt geen lange historie. Bij een bronconflict verschijnt geen vermengd rendement.

De voorspellingsselectie vereist actuele referentiedag, minstens 253 geldige waarnemingen, gecontroleerde volledigheid en onderbouwing van koersaanpassingen, plus een schone relevante historieperiode. Ontbrekend bewijs wordt per bedrijf gerapporteerd. Vooraf vastgelegde selectievelden worden gehasht. Oude ongezegelde voorspellingen blijven bewaard en worden als onvoldoende aantoonbaar vooraf vastgelegd gemarkeerd; zij tellen niet mee als bewezen modelprestaties. Teruggedateerde verwerkingsruns maken geen nieuwe ‘vooraf’ voorspellingen.

Uitkomstmeting gebruikt de slotkoersen ná de referentiedag tot en met de echte kalenderdeadline. Maandultimo en schrikkeldagen zijn begrensd. Latere koersstijgingen veranderen een gemist driemaandsdoel niet in succes. De algemene analytische helpers delen dezelfde kalenderfunctie. Historische diagnostiek op het huidige bedrijvenuniversum wordt uitdrukkelijk niet als bewezen point-in-time backtest gepresenteerd.

## 3. Succesvol uitgevoerd

- `npm test`, inclusief provider-, opslag-, identiteit-, officiële handelsstatus-, website- en nieuwe consolidatiecontroles.
- `npm run history:test`: historische merge/kwaliteit/read-only status, marktneutrale sessieregels en Amsterdamse manifest- en publieke integratiecontrole.
- Alle 19 `scripts/research/test-*.mjs` suites: onder meer point-in-time bewijs, immutable ledger, specialistmodellen, examens, learning, portefeuille en termijnregressies.
- Parijse registertest en read-only herberekening van onderzoeksafgeleiden: 664 inbegrepen, 88 uitgesloten, 17 apart gehouden; de oude selectie is ongewijzigd.
- Volledige code-audit: JavaScript-syntax, JSON, lokale imports, npm/workflow-ingangen en dubbele uitvoerbare bronbestanden; geen fouten. Een al bestaande waarschuwing voor Oslo blijft buiten deze opdracht.
- Beide YAML-workflows geparseerd; alle shellblokken gecontroleerd met `bash -n`.
- De echte marktweergave uitgevoerd met alle 80/105/664 ondernemingen in een DOM-testomgeving. HTTP-controle bevestigt correcte module-MIME en URL-decoding. Een volledige visuele Chromium-controle was in deze omgeving niet mogelijk wegens geblokkeerde socketaanmaak; dit is geen bewijs van visuele browseracceptatie.

Volledige machineleesbare bewijsstukken: `validation-summary.json`, `codebase-audit.json`, `architecture-inventory.json` en `protected-financial-files.json` in de onderzoeksmap van dit bouwblok.

Broncontrole handelsdag **16 november 2026**:

| Markt | Goedgekeurd | Bevestigd verhandeld | Onbevestigd |
|---|---:|---:|---:|
| Amsterdam | 80 | 78 | 2 |
| Brussel | 105 | 97 | 8 |
| Parijs | 664 | 522 | 142 |
| Totaal | 849 | 697 | 152 |

Amsterdam en Brussel gebruikten de standaard collector inclusief toegestane fallbackproviders. De Parijse complete bronproef gebruikte uitsluitend officieel Euronext; de 142 overige gevallen zijn daarom geen bewezen uitval van alle fallbackproviders. Een eerste Parijse standaardrun werd onderweg door de netwerkuitvoeringsomgeving afgebroken; daarop is de volledige officiële bronproef uitgevoerd. Alle 849 identiteiten zijn in de uiteindelijke bronbestanden opgenomen.

Alle 697 bevestigde koersdagen zijn vervolgens in tijdelijke opslag met de echte archiver verwerkt en nogmaals geïmporteerd. Alle 697 geschiedenisdocumenten bleven bij herhaling bytegelijk; er waren geen archiefconflicten. Bestaande koersopslag is daarbij niet beschreven. Ruwe bronresultaten zijn als gzip-JSON opgeslagen, met SHA-256 en alle onbevestigde identiteiten in `live-session-verification.json`.

## 4. Resterende problemen en grenzen

1. De 152 onbevestigde dagkoersen blijven zichtbaar als ontbrekend bewijs. Afwezigheid bewijst geen officiële handelsstilstand; er worden geen nulkoersen of fictieve candles gemaakt. Voor Parijs moet nog worden vastgesteld welke van de 142 gevallen met een toegestane fallback bevestigd kunnen worden.
2. De historische Amsterdamse referentieweek houdt 11 onvoldoende bewezen sessies. De regressietest slaagt doordat deze expliciet zichtbaar blijven; ‘test geslaagd’ betekent niet 100% koersdekking.
3. De 28 oude Parijse opslagidentiteiten, gewijzigde ISIN-aansluitingen en bekende brondefecten blijven in het bestaande Parijse dossier in quarantaine. Er zijn geen historische records gewist, herschaald of automatisch samengevoegd.
4. Nieuwe voorspellingen blijven achterwege waar volledigheid, koersaanpassingen of betrouwbare actuele historie niet bewezen zijn. Dit wordt per onderneming gerapporteerd. Geen claim dat de modellen of hun rendementen al gevalideerd zijn.
5. GitHub activeert cron alleen vanaf de defaultbranch. Deze ontwikkelbranch heeft een afgeschermde `workflow_dispatch`-keten; er is geen actieve onbemande dagplanning aangezet. Defaultbranch-workflows en bestaande externe automatiseringen zijn niet gewijzigd. Live Render-branch/autodeploy-instellingen zijn niet geverifieerd omdat geen Render-workspace geselecteerd was; er is geen deployment uitgevoerd.

## 5. Zijn Amsterdam, Brussel en Parijs klaar voor dagelijkse verwerking?

**De programmaketen op de ontwikkelbranch is geschikt en getest voor alle drie.** Zij controleert alle goedgekeurde identiteiten, verzamelt opening en slot, archiveert zonder betrouwbare bestaande dagrecords te vervangen en verwerkt beurzen onafhankelijk. Dagkoersen zijn niet afhankelijk van oude historie of een voorspelling.

**Een volledig automatisch operationele dienst is hiermee niet aangetoond.** Daarvoor ontbreken geactiveerde veilige planning, verificatie van de Render-testkoppeling en volledige bronbevestiging voor de genoemde ontbrekende sessies. De code mag daarvoor niet worden versoepeld door ontbrekende koersen te verzinnen of kwaliteitsblokkades te verwijderen.

## 6. Klaar voor de volgende Europese beurs?

**Ja, qua centrale architectuur.** Voeg pas na goedkeuring het nieuwe bedrijvenregister, zijn contract en identiteitsdigest toe; controleer de bestaande bronpolicy en navigatie. De collector, archiver, historische lezer, onderzoeksselectie en matrix hoeven geen nieuwe beursgebonden importmachine te krijgen. Een nieuwe beurs heeft nog steeds eigen aantoonbare bron- en identiteitsvalidatie nodig.

## Overdracht

Werk verder vanaf `consolidation-20261116`, met dit rapport en `research/consolidation/2026-11-17/` als bewijs. Behoud de contracten en alle oude historie. Gebruik de centrale dagelijkse workflow; herstel geen verwijderde parallelle schrijvers of Machine 1-entrypoints. Rond de operationele planning en gecontroleerde testsite-koppeling af zonder productie te wijzigen. Onderzoek ontbrekende dagkoersen per identiteit en laat onvoldoende bewezen historische reeksen buiten voorspellingen. Het Parijse bedrijvenonderzoek hoeft niet opnieuw.
