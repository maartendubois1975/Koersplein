# Koersplein — afronding Amsterdam, Brussel en Parijs

Werkbranch: `consolidation-20261116`, voortbouwend op `a99377c1d1e8684a374e580ab7484901e47223f1`. Main en productie worden niet beschreven of gedeployed.

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

De bestaande Amsterdamse geschiedenisbestanden, Parijse dossiers en eerdere consolidatiebewijzen zijn bytegelijk behouden. De echte archiver heeft 698 nieuwe beurs+ISIN-documenten met de bevestigde dag van 16 november aangemaakt in de ontwikkelwerkruimte en de sessiebestanden bijgewerkt. Deze nieuwe documenten worden door de GitHub-archiver in de ontwikkelbranch vastgelegd. De langere oude Cloudflare-reeksen zijn niet verplaatst of herschreven.

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

GitHub-run-ID’s, conclusies en eventuele deploymentstatus worden na uitvoering afzonderlijk vastgelegd. Alleen werkelijk waargenomen resultaten gelden als operationeel bewijs.

## 8. Echte testwebsite

Render bevestigde live deploy `dep-dbtunmp42hec73b2gi3g` op commit a99377c. De dienst staat nog gekoppeld aan `codex/koersplein-home-history`, auto-deploy uit. De echte browser toonde:

- Amsterdam: 80 unieke bedrijven, 76 koersen van 13 november; zoekfunctie ASML werkt.
- Brussel: 105 unieke bedrijven, 98 koersen van 13 november; zoeken op ABO, identiteit en terugnavigatie werken.
- Parijs: 664 unieke bedrijven, 516 koersen van 13 november; zoeken op 2CRSI en de correcte child-MIC ALXP werken.
- Startpagina: onjuist oud aantal Parijs 770; de centrale registeraansluiting is in dit blok hersteld en functioneel getest.
- ASML: echte SVG-grafiek met 7.242 opgeslagen waarnemingen van 20 juli 1998 tot 13 november 2026.
- ABO en 2CRSI: zichtbare melding ‘Historie tijdelijk niet beschikbaar / Failed to fetch’.

De oorzaak van de laatste twee is concreet onderzocht: de historische API antwoordt HTTP 200, maar geeft voor Origin `https://koersplein-test.onrender.com` geen `Access-Control-Allow-Origin`. De bestaande Worker staat alleen de ingestelde productie-origin toe. De browser mag die externe historie daarom niet lezen. De productie-Worker of diens CORS-beveiliging is niet gewijzigd. Een toekomstige toegestane test-API/origin moet deze koppeling oplossen; een geslaagde frontendtest of nieuwe dagelijkse koers bewijst geen toegang tot de diepe Cloudflare-historie.

## 9. Commits en opslag

Alle bron-, test-, workflow-, sessie- en onderzoekswijzigingen blijven op `consolidation-20261116`. De vorige consolidatie is niet teruggedraaid. De centrale dagelijkse workflow bewaart eventuele vervolgdata uitsluitend op dezelfde branch. Een exacte bestandslijst en de uiteindelijke commit- en run-ID’s horen bij het opleveringsbewijs.

## 10. Resterende blokkades voor productie

1. De 13 onzekere historische handelsstatussen en de opvolgerserie van Toosla blijven onder individuele beoordeling; ze blokkeren andere bedrijven niet.
2. Geen actieve universele dagelijkse cron zolang de defaultbranch/overgangsplanning niet wordt gewijzigd. De oude Amsterdamse planning wordt pas in een expliciet toegestane overgang vervangen.
3. De testservice moet op de exacte nieuwe ontwikkelcommit staan; zonder beschikbaar deploymentssecret kan dit niet met de huidige connector worden afgedwongen. De ingetrokken dashboardaanmelding wordt niet opnieuw gevraagd.
4. De test-origin heeft geen toegang tot de diepe Cloudflare-historie. Dit is afzonderlijk van dagelijkse prijsopslag en modelgeschiktheid.
5. Historische kwaliteits- en point-in-time bewijzen blijven nodig vóór modelpromotie. Bronkoersen zijn geen bewezen totaalrendement.

De centrale architectuur is herbruikbaar voor de volgende Europese beurs: goedgekeurd register/identiteitscontract, gevalideerde bronroute en officieel onderhouden kalender aansluiten. Geen nieuwe beursgebonden importmachine toevoegen.
