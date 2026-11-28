# Historische dekking en gericht herstel — 28 november 2026

## Ontwerp vóór implementatie

Uitgangspunt is commit 4749e42 op consolidation-20261116. De vijf goedgekeurde
registers (899 ondernemingen) en de bestaande bronrechten blijven ongewijzigd.
Geen main, productie, Cloudflare, handmatige importworkflow of deployment.

De bestaande operations-report-lezer telt archief en grafiekbasis afzonderlijk.
Hij maakt de overlap en eventuele bron-/dagstatusconflicten niet inzichtelijk.
De bestaande gap-review is alleen een netwerkvoorstel en vereist terecht
expliciete gratis archief-/weergaverechten. De collector hergebruikt opgeslagen
resultaten, maar herstelt tijdelijke fouten nog niet binnen dezelfde geplande run.

## Samenhangende wijziging

1. operations-report en de statusrenderer hergebruiken de bestaande chartmerge
   en bronbesluiten; tellen unieke complete dagen, werkelijk door dagarchieven
   bevestigde dagen, conflicten, ontbrekende sessies en onbekende perioden apart.
   Complete OHLCV bewijst geen corporate-action- of totaalrendementgeschiktheid.
2. history-gap-review krijgt een gehasht plan voor herstel UIT bestaande
   gevalideerde sessies. Toepassen controleert het actuele plan opnieuw onder
   dezelfde exclusieve schrijflock als de dagelijkse archiver en roept die
   bestaande archiver aan. Geen tweede koersopslag of netwerkimporter.
3. approved-daily-session krijgt één begrensde herstelpoging voor tijdelijke
   transportstoringen, met behoud van bevestigde en niet-herstelbare rijen.
   De bestaande geplande workflow blijft de enige operationele ingang.
4. Het statuspaneel toont opgeslagen herstelmetingen en de afzonderlijke
   onveranderbare voorspellingen, inclusief nog onbevestigde evaluaties.

## Acceptatie en faalscenario's

Echte opgeslagen sessies worden in tijdelijke opslag herhaald. Een bewust
verwijderde echte bar moet via de centrale archiver exact terugkomen; herhaling
mag geen bytes wijzigen. Een gewijzigde bron, valuta/identiteit, toekomstige of
gesloten sessie, corrupt archief, bestaande conflicterende bar en gelijktijdige
schrijver moeten blokkeren of expliciet als onopgelost worden getoond.
Transportfouten worden alleen voor betrokken ondernemingen herhaald; een
no-trade-dag wordt nooit een kunstmatige OHLCV-regel. Geblokkeerde bronrechten
veroorzaken geen netwerkverzoek. Voorspellingskernen blijven bytegelijk.

Na samenhangende implementatie: npm test, audit:codebase, history:test, alle
researchtests, Paris-selectiecontrole en onafhankelijke GitHub-regressie.
Controleer registers en prijsarchieven afzonderlijk. Publicatie blijft wachten
op de bestaande geplande exact-SHA-validatie. Rollback: deze softwarecommit
terugdraaien, geen bestaande betrouwbare prijsarchieven verwijderen.

## Werkelijk resultaat

De centrale archiver heeft 681 daadwerkelijk opgeslagen TRADED-regels van
13 november aan de centrale historie toegevoegd: Amsterdam 76, Brussel 94,
Parijs 511. Een deel bestond al in de read-only grafiekbasis; dit zijn dus geen
681 nieuwe unieke kalenderdagen. Alle 383.741 vooraf aanwezige raw koersregels
in 894 bestanden, de instrument-/providermetadata en alle 47 sessiebestanden
zijn behouden. Ook de volledige prediction ledger is bytegelijk gebleven.
Er waren nul nieuwe koersbronverzoeken. Een tweede toepassing van hetzelfde
plan meldt ALREADY_REPAIRED en laat de herstelde bestanden bytegelijk.

De dagarchiver, grafiekvergelijking en historische onderzoekslezer delen nu
de bestaande exacte float32-representatieregel. Bij de aanvulling kwam dit
verschil tussen lezers werkelijk aan het licht in de forecast-source-audit-test.
Een werkelijk OHLC-/volumeconflict blijft een blokkade. De originele
handmatige vensterbesluiten en hun modelhashes zijn opnieuw gecontroleerd.
Er is geen correctie of overschrijving van een oude koers uitgevoerd.

### Lokale opgeslagen dekking

| Beurs | Register | Bedrijven met lokale historie | Unieke complete OHLCV-dagen | In dagarchief bevestigd | Ontbrekende sessies | Onbevestigde sessies | Bevestigd geen handel |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Amsterdam | 80 | 80 | 364.357 | 847 | 1.150 | 4 | 29 |
| Brussel | 105 | 105 | 2.180 | 1.065 | 1.615 | 32 | 58 |
| Parijs | 664 | 579 | 6.957 | 5.635 | 234 | 197 | 1.467 |
| Dublin | 16 | 16 | 3.863 | 99 | 253 | 4 | 9 |
| Lissabon | 34 | 34 | 6.983 | 185 | 1.524 | 0 | 53 |

Totaal 384.340 unieke complete bedrijf/dag-observaties. Dit beschrijft uitsluitend
de lokale gegevens van deze build, niet de volledige externe grafiekopslag.
Er zijn vier technisch onvolledige legacy-records; deze zijn behouden en tellen
niet als complete koersdagen. Ontbrekende/onbevestigde sessies worden alleen
binnen de beoordeelde periode en beschikbare kalenderjaren geteld. Voor 898
ondernemingen is de daadwerkelijke noteringsstart niet bewezen; de oudste
waarneming is geen bewijs van volledige historie sinds de beursgang. Een
beoordeelde bronkeuze waarvan de grafiekbasis lokaal ontbreekt wordt expliciet
als niet-naspeelbaar getoond, niet als verzonnen bronconflict.

Het paneel toont deze tellingen, herstelbewijs, bronrechten voor nieuwe
historische verzoeken, verwerking ten opzichte van de afgesloten sessie en de
twee afzonderlijke verzegelde voorspellingen. Er zijn nul afgeronde gevalideerde
voorspellingen: geen bewezen slagingspercentage of modelverbetering. De nieuwe
gerichte dagelijkse herstelpoging is met echte opgeslagen bars en geïnjecteerde
transportfouten getest; er is nog geen echte geplande uitvoering van die nieuwe
herstelroutine vastgelegd. Dat wordt in de interface ook zo aangegeven.

### Oslo: 21 aanvullende exacte uitgeverkoppelingen

Alle 22 resterende kandidaten zijn op actuele GLEIF-entiteiten onderzocht.
Twintig hebben een primaire bron die ISIN en LEI samen vermeldt. Voor S.D.
Standard ETC verbindt het officiële prospectus het ISIN aan het exacte
Cypriotische registratienummer HE 277936; GLEIF bevestigt datzelfde nummer, de
huidige LEI en de vroegere juridische naam S.D. Standard Drilling. Dit is een
gedocumenteerde registratiebrug, geen fuzzy naamkoppeling. De 222 eerdere
voorstellen blijven intact: totaal 243/244, zonder dubbele uitgevers.

RomReal blijft open: GLEIF bevestigt een actieve entiteit en LEI, maar de
ISIN-koppeling is leeg en het opgehaalde officiële jaarverslag bevestigt niet
de combinatie ISIN/LEI/registratie 37382. Secundaire overeenkomsten worden niet
tot een toelatingsbesluit verheven. De actuele GLEIF-naam van Volare bevat
PTE. LTD.; de officiële beurskaart noemt de exacte LEI en ISIN. Deze bevinding
staat expliciet in het voorstel en wijzigt geen noterings-/naambesluit.

De uitgevervoorstellen staan in research/admission/2026-11-28, met 22 opgeslagen
CC0 GLEIF-records, bronhashes en primaire verwijzingen. Oslo wordt niet automatisch
toegelaten. Ook voor Milaan blijven de eerder vastgestelde publicatierechten
een blokkade. De vijf bestaande bronregisters zijn ongewijzigd; voor NIEUWE
historische netwerkopvragingen zijn daarin geen expliciete gratis openbare
archiefrechten vastgelegd. De nieuwe gap-route blijft daardoor terecht dicht.

### Uitgevoerde controle en publicatie

Geslaagd: npm test, npm run audit:codebase, npm run history:test, de Paris-
selectiecontrole en alle 22 researchtestbestanden. Aanvullend zijn de echte
statusrenderer en het Oslo-bewijs afzonderlijk getest. Hersteltests dekken
gedeeltelijke opslag, herhaling, een gelijktijdige schrijver, corrupt bewijs,
gesloten/toekomstige sessies, gewijzigde bron-/prijsgegevens, ontbrekende
bronrechten en alleen een tijdelijke fout opnieuw opvragen. De nieuwe
Oslo-test is opgenomen in history:core:test voor de gewone CI/buildketen.

Gehasht herstelplan, daadwerkelijk uitvoeringsbewijs, dekking en testloghashes:
research/completion/2026-11-28. De normale dagworkflow blijft dezelfde CLI
aanroepen; er is geen nieuwe workflow of dienst gemaakt of gestart. De
schrijflock wordt na een crash niet automatisch verwijderd: de lock moet eerst
op een nog actieve schrijver worden onderzocht.

Bij laatste Render-controle stond de testservice nog op b3e2cb2,
dep-dc47u0d9el5s73ag70d0. De nieuwe wijzigingen zijn lokaal getest; de uiteindelijke
GitHub-commit en onafhankelijke CI worden in de oplevering apart benoemd.
Geen live browseracceptatie van deze ongepubliceerde versie geclaimd. De
bestaande geplande publicatie blijft de exacte dagelijkse SHA-validatie vereisen.
