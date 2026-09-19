# Koersplein A-tot-Z architectuuraudit

## Bron van waarheid
- GitHub `main` is de codebron.
- Cloudflare/API is de historische datastore.
- `RESEARCH_PROTOCOL.md` bepaalt de wetenschappelijke regels.
- `MACHINE_ARCHITECTURE.md` bepaalt de huidige machinefuncties.
- Oude eenmalige workflows zijn archief/diagnostiek en mogen niet autonoom concurreren met de actuele keten.

## Gevonden structurele oorzaken
1. De wereldvuller gebruikte iedere run opnieuw offset 0 en bewaarde voortgang alleen als tijdelijk artifact. Daardoor kon dezelfde eerste batch steeds opnieuw worden geraakt.
2. Parijs had meerdere overlappende backfill/reparatie/validatieworkflows met verschillende concurrency-groepen.
3. De Parijs-reparatieworkflow bevatte een letterlijke `\\n` in YAML en werd door codewijzigingen onnodig opnieuw gestart.
4. Hindsight had hetzelfde escape-probleem in JavaScript en push-triggers veroorzaakten extra runs tijdens reparaties.
5. Oude Model Arena/Research Director routes bestaan naast de definitieve arena. Ze zijn nuttig als archief, maar mogen niet automatisch draaien.
6. PR #39 bevatte een oudere target-engine en dubbele +30-workflows; deze PR is gesloten om een latere accidentele merge te voorkomen.
7. `data/machine-pipeline.json` gebruikt oudere M02-M08-nummering en loopt inhoudelijk achter op de 10-functiearchitectuur.
8. Parijs bevat echte provider-onbeschikbaarheid; een wereldgate met letterlijk 0 ontbrekende instrumenten kan daardoor nooit passeren zonder expliciete, geaudite uitsluitingen.

## Reparatiebeleid
- Eén schrijver per operationele fase.
- Geen automatische push-trigger voor zware eenmalige onderzoeks-/reparatieruns.
- Wereldvulling kiest dynamisch werkelijk ontbrekende/verouderde instrumenten; geen vluchtige offset als voortgangsbron.
- Provider-onbeschikbare instrumenten zijn expliciete exclusions, geen eindeloze retry.
- Elke zware run heeft een inhoudelijke output-gate; groen zonder bruikbare output is geen succes.
- Parijs blijft blind voor modelontwikkeling totdat de datagate expliciet PASS geeft.
