# Koersplein — afronding Amsterdam, Brussel en Parijs

Werkbranch: `consolidation-20261116`, voortbouwend op `a99377c1d1e8684a374e580ab7484901e47223f1`. Main en productie zijn niet gewijzigd of gedeployed.

## 1. Bedrijvenregisters

Alle goedgekeurde selecties en identiteitsdigests zijn ongewijzigd: Amsterdam 80, Brussel 105, Parijs 664; totaal 849. De startpagina gebruikte voor Parijs nog de oude ruwe catalogus met 770 regels. Deze gebruikt nu dezelfde `browserCatalog`-functie en contracten als de beurs- en aandeelpagina’s.

## 2. Bevestigde dagelijkse gegevens

Alle 152 eerdere onopgeloste gevallen zijn afzonderlijk bij officieel Euronext en de bestaande Yahoo-koppelingen onderzocht. Alle bronresponsen en beslissingen staan in `research/completion/2026-11-17/`.

| Markt | Bedrijven | Uitgevoerde koersdag 16 november | Officieel geen handel | Nog onbevestigd |
|---|---:|---:|---:|---:|
| Amsterdam | 80 | 78 | 2 | 0 |
| Brussel | 105 | 97 | 4 | 4 |
| Parijs | 664 | 523 | 132 | 9 |
| Totaal | 849 | 698 | 138 | 13 |

Dit zijn de resultaten van de complete bronbewijsketen, inclusief hergebruik van de eerder bevestigde 697 koersdagen. Toosla leverde de extra bevestigde koersdag via de al toegestane Yahoo-provider, uitsluitend onder de oude ISIN en vóór de ingangsdatum van de wijziging. Dagelijkse live-runs kunnen later minder NO_TRADES opnieuw bewijzen doordat een nieuwe transactie de bronvermelding ‘laatst verhandeld’ verandert; daarom bewaart de archiver eerder bewezen sessiestatussen bij latere zwakkere gegevens.

## 3. Resterende gegevens en concrete oorzaken

Negen gevallen hebben een officiële nulvolume-referentierij voor 16 november, maar de actuele quote is inmiddels van een transactie op 17 november. Die latere transactie bewijst geen OHLC of geen-handel-status op de vorige dag: NEWT, MLTV, FOU, FLOB, ALDBL, ALVGO, ALECR, MLPHW en MLACT. De bestaande Yahoo-koppelingen leverden geen verifieerbare uitgevoerde koersdag voor 16 november.

Vier gevallen tonen wel een indicatieve waarderingskoers, maar geen bewijs van een uitgevoerde transactie/laatste uitgevoerde datum: MLSJA, MLHA2, MLIME en MLGL. Een indicatieve slotwaarde wordt geen fictieve opening of slottransactie. Deze dertien instrumenten blijven verwerkt en zichtbaar; hun onzekere daggegevens worden apart gehouden.

Actuele handelsopschortingen en reserveringen zijn per instrument vastgelegd uit de instrumentquote, met waarnemingsdatum en reden. De huidige opschorting wordt niet automatisch teruggeprojecteerd op 16 november. Navigatiemenu’s en oude schorsingsberichten gelden niet als actuele instrumentstatus.

Toosla: de uitgevende onderneming bevestigt de overgang van FR00140062B9 naar FR001401B9V8 per 17 november, met 3.334 oude aandelen per nieuw aandeel. De nieuwe Euronext-quote bevat nog een vóór die datum gedateerde oude microkoers. Daarom blokkeert één centraal `instrument-events.json` oude-ISIN-verzoeken vanaf de ingangsdatum bij dagelijkse import, generieke bronselectie en voorspellingen. Er worden geen aandelen verwijderd, geen historische prijzen vermenigvuldigd en geen reeksen samengeplakt. De opvolgerserie moet apart op juiste actuele prijseenheid en ingangsdatum worden vrijgegeven.

## 4. Dagelijkse import en planning

De bestaande centrale collector en archiver zijn uitgebreid; er is geen tweede importmachine gebouwd. De datum wordt per markt vastgezet bij aanvang van de GitHub-run. De officiële feestdagen en halve handelsdagen van 2026/2027, Europe/Paris-tijdzone en zomertijd worden gebruikt. Verzameling begint conservatief na 18:15 lokale tijd, ook op halve dagen. Onbekende kalenderjaren of niet-goedgekeurde marktkalenders blokkeren expliciet in plaats van werkdagen te raden.

NO_TRADES vereist zowel een bij de identiteit passende officiële laatst-uitgevoerde datum vóór de aangevraagde dag als de gedateerde nulvolume-referentierij. Alleen een ontbrekende candle of nulvolume is onvoldoende. De website toont de status afzonderlijk van de koers; opening en slot blijven leeg.

De bestaande workflow kan handmatig en bij wijzigingen aan zijn centrale importbestanden automatisch starten op uitsluitend `consolidation-20261116`. De data-commits veroorzaken geen importlus. De marktjobs gebruiken `fail-fast: false`; geslaagde markten worden onafhankelijk bewaard. Onderzoeksfouten kunnen de al bewaarde koersgegevens niet terugdraaien. Een herimport verandert bestaande bevestigde koersrecords niet en zwakkere latere gegevens verdringen ook geen bewezen NO_TRADES.

**Dit activeert geen dagelijkse cron op een niet-defaultbranch.** GitHub voert schedule-events uitsluitend vanaf de defaultbranch uit. Main heeft nog de oude, afzonderlijk naar `amsterdam-reset-20261027` schrijvende `amsterdam-staging-schedule.yml`. Die is gelezen maar niet gewijzigd; zijn gegevens worden niet in de nieuwe centrale branch gemengd. Een latere productieovergang moet de oude planning vervangen door één trigger van de geteste centrale keten. Er is bewust geen tweede autonome cron of extra Render-service gemaakt.

Een optionele laatste stap in dezelfde workflow kan via een reeds aanwezige `RENDER_API_KEY`-repositorysecret uitsluitend de bestaande testservice `srv-dajuqaek1f9s739gu8kg` aan de ontwikkelbranch koppelen en de exacte, na opslag geteste commit deployen. Naam, repository, type, URL, branch en commit worden gecontroleerd; de productieservice wordt geweigerd. Ontbreekt het secret, dan geeft de stap expliciet `BLOCKED_CREDENTIAL_ABSENT`; een groene overige workflow is dan geen bewijs van een deployment. De beschikbare Render-connector kan de branch of exacte commit niet instellen. Er wordt niet opnieuw om browseraanmelding gevraagd.

## 5. Historische opslag

De bestaande Amsterdamse geschiedenisbestanden, Parijse dossiers en eerdere consolidatiebewijzen zijn bytegelijk behouden. De echte archiver heeft 698 nieuwe beurs+ISIN-documenten met de bevestigde dag van 16 november aangemaakt in de ontwikkelwerkruimte en de sessiebestanden bijgewerkt. Deze 698 nieuwe documenten zijn daadwerkelijk door de GitHub-archiver in commit `a2497b8` op de ontwikkelbranch vastgelegd. De live herverzameling bracht voor Softimat alleen een gewijzigde Yahoo-volumeobservatie (165 versus 2.500) mee; OHLC is identiek. Het oorspronkelijke record is behouden en de nieuwe observatie staat afzonderlijk in `github-fresh-XBRU.json`. De langere oude Cloudflare-reeksen zijn niet verplaatst of herschreven.

De 28 oude Parijse opslagidentiteiten, bekende verkeerde MIC’s, gewijzigde ISIN-aansluitingen en brondefecten blijven afzonderlijke dossiers. Er worden geen vermoedelijke koerscorrecties automatisch toegepast. Alle gegevens hebben dezelfde instrumentidentiteit; een korte dagstaart mag een langere toegankelijke historie niet verdringen.

## 6. Voorspellingen

De centrale onderzoekslogica en immutable voorspellingsvelden blijven bestaan. Historieomvang, OHLC-kwaliteit, bronidentiteit, actuele referentiedag, onderbouwde volledigheid en koersaanpassingen blijven vereist. Het nieuwe corporate-action-signaal geldt ook voor de generieke historische lezer en bronroute. Geen voorspelling op alleen een nieuwe dagkoers of onbewezen opvolgerserie. Kalenderhorizons en de uitsluiting van latere +30%-hits blijven getest.

## 7. Tests en bewijs

- `npm test`: volledige registers/provider/opslag/website-regressies en nieuwe consolidatiecontroles.
- `npm run history:test`: historische integratie, bronselectie, read-only status en historiebehoud. De bekende 11 onbewezen sessies van de oude Amsterdamse referentieweek blijven expliciet gerapporteerd.
- Alle 19 onderzoeksregressies: geslaagd.
- Volledige code-audit: geen fouten; de bestaande Oslo-brondiversiteitswaarschuwing blijft buiten deze opdracht.
- Beide workflows geparseerd, alle shellblokken met `bash -n` gecontroleerd.
- Alle 152 echte brongevallen gebruikt voor positieve en negatieve bewijscontroles; identiteit, latere transactie, ontbrekende laatst-uitgevoerde datum en te oude snapshot worden niet geaccepteerd als NO_TRADES-bewijs.
- Feestdagen, Pasen, zomertijd, halve dagen, onbekend kalenderjaar en ISIN-ingangsdatum getest.
- Volledige 849-bedrijvenketen met 698 echte koersdagen in tijdelijke opslag uitgevoerd en herhaald. Geen gewijzigde koersbytes bij herhaling; eerdere bewezen sessiestatussen overleven een herhaling met zwakkere broninformatie.
- Testdeployment: juiste service en exacte commit, ontbreken van credentials en weigering van productie getest met infrastructuurfixtures. Dit is geen bewijs van een live deployment.

De volledige GitHub-regressierun [44123969001](https://github.com/maartendubois1975/Koersplein/actions/runs/44123969001) is geslaagd. De echte dagelijkse keten [44123968285](https://github.com/maartendubois1975/Koersplein/actions/runs/44123968285) is eveneens geslaagd: register, alle drie de live marktjobs, opslag, onderzoek en finale datavalidatie. De laatste stap rapporteert **BLOCKED_CREDENTIAL_ABSENT**: er is geen Render-secret beschikbaar. De groene workflow betekent dus uitdrukkelijk geen succesvolle publicatie.

De verse herverzameling gaf 698 TRADED, 126 NO_TRADES en 25 SESSION_UNVERIFIED. Door behoud van eerder in dit blok officieel bewezen sessiestatussen is de definitieve opslag 698/138/13, zoals in de tabel. De nieuwe bronwaarnemingen worden niet als vervanging van sterker eerder bewijs gebruikt. Alle job-ID’s, aantallen en de afzonderlijke volumeafwijking staan in `research/completion/2026-11-17/github-execution.json`.

De echte voorspellingsrun heeft **nul nieuwe selecties** gepubliceerd. Alle 849 historische invoeren missen nog de vereiste volledige herkomst-/kwaliteitsbewijzen en zijn expliciet geweigerd; dit is geen werkende adviesdekking. Twee oude, niet vooraf verzegelde voorspellingen blijven EVALUATION_UNVERIFIED: één staat buiten het goedgekeurde marktregister, één heeft een afwijkende referentiekoers. De volledige diagnoses zijn duurzaam opgeslagen in `github-daily-opportunity-diagnostics.json`.

## 8. Echte testwebsite

Render bevestigde live deploy `dep-dbtunmp42hec73b2gi3g` op commit a99377c. De dienst staat nog gekoppeld aan `codex/koersplein-home-history`, auto-deploy uit. De echte browser toonde:

- Amsterdam: 80 unieke bedrijven, 76 koersen van 13 november; zoekfunctie ASML werkt.
- Brussel: 105 unieke bedrijven, 98 koersen van 13 november; zoeken op ABO, identiteit en terugnavigatie werken.
- Parijs: 664 unieke bedrijven, 516 koersen van 13 november; zoeken op 2CRSI en de correcte child-MIC ALXP werken.
- Startpagina: onjuist oud aantal Parijs 770; de centrale registeraansluiting is in dit blok hersteld en functioneel getest.
- ASML: echte SVG-grafiek met 7.242 opgeslagen waarnemingen van 20 juli 1998 tot 13 november 2026.
- ABO en 2CRSI: zichtbare melding ‘Historie tijdelijk niet beschikbaar / Failed to fetch’.

De oorzaak van de laatste twee is concreet onderzocht: de historische API antwoordt HTTP 200, maar geeft voor Origin `https://koersplein-test.onrender.com` geen `Access-Control-Allow-Origin`. De bestaande Worker staat alleen de ingestelde productie-origin toe. De browser mag die externe historie daarom niet lezen. De productie-Worker of diens CORS-beveiliging is niet gewijzigd. Een toekomstige toegestane test-API/origin moet deze koppeling oplossen; een geslaagde frontendtest of nieuwe dagelijkse koers bewijst geen toegang tot de diepe Cloudflare-historie.

De finale Render-controle bevestigt dat de live versie ongewijzigd commit `a99377c` is. Ook de echte browser toont nog het oude startpagina-aantal Parijs 770. De nieuwe correctie en de gegevens van 16 november zijn dus gebouwd en op GitHub getest/opgeslagen, maar nog niet op de publieke testwebsite bewezen.

## 9. Commits en opslag

Commits in dit afrondingsblok:

- `c5eef04dd8a48b63d80cd8a192223afb98cd6c71`: centrale bronbewijslogica, kalender, ISIN-event, weergave, tests en individuele dossiers.
- `a2497b89319796e11cebf7ffdc331ca48ca9d1de`: echte GitHub-opslag van 698 dagelijkse historiedocumenten en zes sessiesnapshots.
- `49b40166ad1979850af44fd5f3fbd3734c27a47d`: echte uitvoering van de beveiligde voorspellingsketen.

De exacte 46 bron-/test-/dossierbestanden van de codecommit staan in `research/completion/2026-11-17/changed-files.json`. In dit vervolgblok zijn geen extra scripts verwijderd: de vorige consolidatie had reeds 30 verouderde bestanden verwijderd. Er is geen nieuwe parallelle importmachine toegevoegd.

Alle bron-, test-, workflow-, sessie- en onderzoekswijzigingen blijven op `consolidation-20261116`. De vorige consolidatie is niet teruggedraaid. De centrale dagelijkse workflow bewaart eventuele vervolgdata uitsluitend op dezelfde branch. Een exacte bestandslijst en de uiteindelijke commit- en run-ID’s horen bij het opleveringsbewijs.

## 10. Resterende blokkades voor productie

1. De 13 onzekere historische handelsstatussen en de opvolgerserie van Toosla blijven onder individuele beoordeling; ze blokkeren andere bedrijven niet.
2. Geen actieve universele dagelijkse cron zolang de defaultbranch/overgangsplanning niet wordt gewijzigd. De oude Amsterdamse planning wordt pas in een expliciet toegestane overgang vervangen.
3. De testservice moet op de exacte nieuwe ontwikkelcommit staan; zonder beschikbaar deploymentssecret kan dit niet met de huidige connector worden afgedwongen. De ingetrokken dashboardaanmelding wordt niet opnieuw gevraagd.
4. De test-origin heeft geen toegang tot de diepe Cloudflare-historie. Dit is afzonderlijk van dagelijkse prijsopslag en modelgeschiktheid.
5. Historische kwaliteits- en point-in-time bewijzen blijven nodig vóór modelpromotie. Bronkoersen zijn geen bewezen totaalrendement.

De centrale architectuur is herbruikbaar voor de volgende Europese beurs: goedgekeurd register/identiteitscontract, gevalideerde bronroute en officieel onderhouden kalender aansluiten. Geen nieuwe beursgebonden importmachine toevoegen.

## Kopieerbare overdracht voor de bestaande Koersplein-chat

```text
KOERSPLEIN — OVERDRACHT 17 NOVEMBER 2026
Repository maartendubois1975/Koersplein; werk uitsluitend op consolidation-20261116.
Behoud de consolidatie a99377c en de nieuwe codecommit c5eef04. Geen productie/main wijzigen.
Goedgekeurd register ongewijzigd: Amsterdam 80, Brussel 105, Parijs 664 = 849.
152 onopgeloste gevallen afzonderlijk onderzocht met opgeslagen officiële bronresponsen.
Dag 16 november: Amsterdam 78 TRADED/2 NO_TRADES/0 onzeker; Brussel 97/4/4; Parijs 523/132/9.
Totaal 698 echte koersdagen, 138 bewezen geen handel, 13 onbevestigd; geen fictieve OHLC.
GitHub echte volledige keten 44123968285: geslaagd. Opslagcommit a2497b8, onderzoekscommit 49b4016.
GitHub volledige regressie 44123969001: geslaagd. Ook npm test/history:test, 19 onderzoekstests en codeaudit geslaagd.
698 canonieke dagelijkse historiedocumenten opgeslagen; bestaande historie/Paris-dossiers beschermd.
Softimat: Yahoo herzag alleen volume van 165 naar 2500, OHLC identiek; origineel behouden, conflict geregistreerd.
Toosla FR00140062B9 -> FR001401B9V8 per 17 november (3334:1). Oude identiteit vanaf ingang in quarantaine; geen automatische serieverbinding.
Voorspellingsrun: nul nieuwe selecties; 849 invoeren hebben nog onvoldoende bewezen historische provenance. Twee oude voorspellingen blijven onbevestigd.
Testsite daadwerkelijk onderzocht: 80/105/664 bedrijven, zoeken/navigatie goed; ASML-historiegrafiek zichtbaar, ABO/2CRSI externe historie geblokkeerd door ontbrekende CORS-toestemming voor test-origin.
Render live nog a99377c, testservice srv-dajuqaek1f9s739gu8kg gekoppeld aan codex/koersplein-home-history, auto-deploy uit.
Testdeployment in echte workflow geprobeerd: BLOCKED_CREDENTIAL_ABSENT (RENDER_API_KEY niet aanwezig). Geen nieuwe versie live.
Geen universele dagelijkse cron actief op ontwikkelbranch: GitHub schedule draait alleen defaultbranch. Oude main-Amsterdamplanning is alleen gelezen en niet gewijzigd.
Resterende technische afronding: toegestane deploymenttoegang/testservice koppelen; veilige toegang tot diepe historie voor test-origin; expliciet toegestane overgang van oude main-planning naar de ene centrale workflow; historische provenance per serie vrijgeven; 13 onzekere statussen en Toosla-opvolgerserie individueel afhandelen.
Dossier: docs/COMPLETION_2026-11-17.md; research/completion/2026-11-17/ bevat individuele beslissingen, bronarchief, GitHub-uitvoering, regressies en bestandsmanifest.
Geen tweede importmachine bouwen, geen historiedata vervangen en geen advies uit korte of onbevestigde reeksen.
```
