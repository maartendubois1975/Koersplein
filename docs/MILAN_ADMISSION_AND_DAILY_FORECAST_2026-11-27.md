# Milanese toelating en dagelijkse voortzetting — 27 november 2026

Basis: 178484c. Dit blok vult de technische toelating aan en vervangt de eerdere beschrijving van ontbrekende Milanese operationele velden. De vijf actieve registers blijven ongewijzigd: Amsterdam 80, Brussel 105, Parijs 664, Dublin 16, Lissabon 34. Er is geen zesde actieve koersbeurs.

## Milaan: technische keten gereed, één externe toelatingsblokkade

Alle 360 geselecteerde ondernemingen hebben nu een expliciete, unieke LEI-uitgeveridentiteit. De officiële GLEIF/ANNA ISIN–LEI-relatie van 26 november dekt er 357. Campari, Cementir en d'Amico zijn afzonderlijk bevestigd met primaire bronnen die zowel ISIN als LEI vermelden, plus actuele GLEIF-entiteitsrecords. De originele ISIN/symbool/MIC-selectie en haar hash blijven gelijk. GLEIF publiceert zijn gegevens onder CC0. Er is geen naamvergelijking gebruikt als vervanging voor een exacte ISIN-koppeling.

De centrale catalogusvalidator controleert nu ook dubbele uitgever-ID's en de ISO 17442-checksum van LEI-ID's. De herbruikbare issuer-proposer levert alleen voorstellen en open gevallen. Hij bepaalt geen hoofdbeurs, bedrijfsactiviteit of toelating en wijzigt geen register automatisch.

De bestaande preview heeft de ontbrekende navigatievelden gekregen. Het centrale bronregister benoemt nu de technisch getoetste Euronext-route voor dagelijkse en historische data. Yahoo blijft een onderzoekskandidaat en is geen automatische fallback. De publieke rechten staan expliciet onbevestigd. De oude COMPLETE-status van Milaan in het legacy-wereldplan is gecorrigeerd naar BLOCKED met reden UNVERIFIED_PUBLICATION_RIGHTS. De oude voltooiingsmetadata blijven onder previousResearchCompletion bewaard. Daardoor kan een verouderde 401-selectie niet onterecht als afgeronde koersmarkt gelden.

De actuele toelatingscontrole levert voor Milaan nog één blokkade op: **UNVERIFIED_PUBLICATION_RIGHTS**. Geen ontbrekende uitgeveridentiteiten, navigatievelden of bronroutes meer.

### Uitgevoerde volledige source replay

Voor alle 51 nulvolume-regels van 26 november zijn nieuwe officiële quoteheaders opgehaald. Iedere header bevestigt de juiste ISIN, MIC en EUR-valuta, met een laatste transactiedatum vóór 26 november. In combinatie met de officiële dagtabel bewijst dit 51 dagen zonder handel. De bestaande 309 echte handelsdagen zijn eerder onafhankelijk aan het transparantiebestand getoetst.

De gedeelde collector, archiver, grafiekpublicatie en beursrenderer zijn nu met het volledige 360-bedrijvenregister in tijdelijke opslag getest. Hiervoor worden echte bronwaarnemingen en expliciete testafhankelijkheden gebruikt, zonder netwerkfallback of nieuwe service. De tijdelijke technische bronconfiguratie verleent geen licentie en activeert geen publiek register.

| Gemeten replay voor 26 november | Aantal |
|---|---:|
| Ondernemingen | 360 |
| Verhandeld | 309 |
| Officieel bevestigd zonder handel | 51 |
| Onbevestigd | 0 |
| Uitgeveridentiteiten | 360 |
| Grafiekbestanden in tijdelijke proef | 310 |

De 310 tijdelijke grafiekbestanden bestaan uit 309 echte dagbars plus één onafhankelijk opgehaalde eerdere sessie van Alfio Bardolla. Voor ABTG toont de bestaande renderer op de dag zonder handel de bevestigde slotkoers van 25 november met die werkelijke datum. Er is geen nulvolume-candle of fictieve 26-novemberprijs aangemaakt. Alle 360 bedrijven verschijnen in de beursweergave. De tweede archivering blijft bytegelijk. Een enkele dag wordt terecht niet als voldoende modelhistorie toegelaten.

Dit is een technische replay. De Milanese data zijn niet toegevoegd aan het operationele publieke koersarchief. De bestaande volledige historische bronproef wordt hergebruikt; er is geen nieuw volledig historisch bestand geïmporteerd.

## Gratis gebruik: concreet besluit op de huidige contracten

De actuele EMDA, Information Product Fee Schedule V21.1 en Delayed Fee Waiver Application Form V3.0, effectief vanaf oktober 2026, zijn geopend en onderzocht. Bron-URL's en hashes staan in `research/admission/2026-11-27/free-publication-decision.json`.

Het actuele waiver-formulier vereist een getekende EMDA en beoordeling door Euronext. Een vrijstelling is niet automatisch; tijdens beoordeling worden betaalverplichtingen niet opgeschort. Het formulier noemt ook toegevoegde diensten en direct economisch voordeel als mogelijke betaalplichtige omstandigheden. De EMDA definieert historische data van vóór de vorige werkdag als een afzonderlijk product onder een andere overeenkomst. De eerdere aankondiging over After Midnight-tarieven bewijst dus geen onvoorwaardelijke gratis toestemming voor Koerspleins gekozen Live-endpoints, voorspellingen en publieke archief.

Er is geen overeenkomst ondertekend, aanvraag ingediend, mail verzonden of betaalverplichting aangegaan. Het concrete, niet-verzonden verzoek staat in `FREE_PERMISSION_REQUEST_DRAFT.md`. Nodig is schriftelijke, expliciete bevestiging dat het omschreven ophalen, publiek tonen, bewaren en modelgebruik zonder kosten is toegestaan. Gegevens van de contractspartij en verklaringen over inkomsten zijn niet ingevuld of verzonnen. De dagelijkse bron is technisch goedgekeurd; dit is geen goedkeuring voor herpublicatie.

## Dagelijkse modelvensters: append-only voortzetting

De achttien eerder handmatig beoordeelde ondernemingen vormen de enige automatische startgroep. Hun oorspronkelijke beslissingen blijven exact behouden in de bestaande manifest. Nieuwe bedrijven kunnen niet via deze route worden toegevoegd.

De bestaande geplande onderzoeksjob voert vóór de bestaande selecties nu de volgende controle uit:

1. Alleen de laatst afgesloten, open sessie van de betreffende beurs kan worden beoordeeld. De actuele primaire MIC/symbool/valuta moeten nog bij het goedgekeurde register passen.
2. Een reeds beoordeelde dag wordt lokaal opnieuw op integriteit gecontroleerd, zonder herhaalde bronverzoeken.
3. Voor een nieuwe dag worden verse officiële N- en Y-vensters, instrumentidentiteit, valuta en volledige bedrijfsmededelingen opgehaald. De bron moet aantoonbaar na afsluiting van de peildag zijn waargenomen. Suspensies of tegenstrijdige quotedatums blokkeren.
4. Iedere overlappende bar moet overeenkomen met het eerdere beoordeelde modelvenster. Oude expliciet beoordeelde hoog/laagselecties mogen worden behouden; nieuwe correcties krijgen geen automatische toestemming.
5. Alleen exact ongewijzigde eerder beoordeelde gebeurtenissen mogen worden herkend. Nieuwe kapitaalgebeurtenissen of andere onduidelijke acties vereisen een nieuwe individuele beoordeling.
6. Maximaal tien open sessies achterstand kunnen in één gecontroleerde actuele stap worden ingehaald. Er ontstaan geen teruggedateerde voorspellingen voor overgeslagen dagen.
7. Bronbewijs wordt inhoudsgebonden en onvervangbaar opgeslagen. De manifest wordt onder exclusief schrijversslot en met een vergelijking van de oorspronkelijke inhoud uitgebreid. Bestaande beslissingen en eerdere voortzettingen blijven behouden.

De forecastlezer controleert ouderhashes en bronbestanden en speelt de beslissing opnieuw af vóór gebruik. Een gewijzigd of verdwenen bewijsbestand blijft geblokkeerd en wordt niet stilzwijgend vervangen. Bij een tijdelijke bronstoring kunnen andere ondernemingen doorgaan. Een herhaling haalt alleen de eerder mislukte onderneming opnieuw op; geslaagde dossiers en oude selecties blijven intact.

Ook de evaluatie van verzegelde voorspellingen en hun benchmark vereist nu bevestigde broncontrole voor de betreffende evaluatiedag. Een onbevestigde bron- of kapitaalgebeurtenis wordt niet als modelwinst of geldige benchmarkvergelijking geteld. De consensusformule en voorspelde doelen zijn niet aangepast.

De echte 25→26-novemberreplay gebruikt 254 waargenomen sessies van Adyen en Basic-Fit. De 253-sessiesoftwarevensters hebben 252 dagen overlap en één echte nieuwe dag. Dit is een expliciete softwaretest; er zijn geen historische toelatingsbesluiten of voorspellingen teruggedateerd. Tests omvatten veranderde overlap, nieuwe correcties, onbekende kapitaalgebeurtenissen, verouderde bron, suspensie, toekomstdata, gewijzigde ouderbeslissingen, corrupt bewijs en gedeeltelijk bronherstel.

De huidige werkelijke uitvoering voor 26 november hergebruikte alle achttien bestaande dossiers: nul nieuwe voortzettingen, nul onbevestigde dossiers. Er is nog geen afgesloten 27-novembersessie verwerkt. De normale selectie-/evaluatie-ingang is eveneens uitgevoerd. De oorspronkelijke ledger bleef byte voor byte gelijk: één verzegelde Basic-Fit-voorspelling, haar oorspronkelijke tweeledige benchmark, twee oudere onbevestigde records en nul nieuwe voorspellingen. Er zijn nog nul afgeronde gevalideerde resultaten.

## Oslo en statuspagina

Dezelfde GLEIF-relatie en issuer-proposer zijn toegepast op de bestaande 244 Oslo-kandidaten. Er zijn 222 exacte koppelingen en 22 open gevallen, zonder dubbele LEI's binnen de gekoppelde groep. Deze voorstellen wijzigen het Oslo-register niet automatisch en activeren geen nieuwe beurs. Ze staan in `oslo-issuer-proposals.json`.

De bestaande statuspagina toont voor Milaan nu ook 51 bevestigde dagen zonder handel, nul onbevestigd en 360 bevestigde uitgeveridentiteiten, naast de 309 transacties en de resterende rechtenblokkade. De dagelijkse bronvenstercontrole wordt met echte peildatum, bestaande/nieuwe/onbevestigde dossiers en waargenomen storingen getoond. De pagina verzint geen gegevens wanneer een rapport ontbreekt of uit de toekomst komt.

## Acceptatie, publicatie en rollback

De verplichte lokale testketen en de onafhankelijke GitHub-regressie worden afzonderlijk gerapporteerd. De oorspronkelijke vijf registers, bronnen voor die vijf, koersarchieven, handmatige modelvensters en ledger zijn niet gewijzigd. Het bronrouteregressiepatroon is aangepast aan de expliciete dependency-injectie; het controleert nog steeds dat de operationele standaard het centrale bronregister gebruikt. De codeaudit wees terecht op de verouderde COMPLETE/fingerprint-combinatie van Milaan; de daadwerkelijke status is gecorrigeerd en de audit is niet versoepeld.

Bij de laatste Render-controle was b3e2cb2 nog live. Er is geen handmatige importworkflow, deployment, andere service, productie- of Cloudflare-wijziging gestart. De bestaande geplande testpublicatie behoudt haar volledige veiligheidscontroles. Visuele acceptatie van de nieuwe live versie blijft open zolang deze niet gepubliceerd is. De eerdere browserruntimebeperking is niet als geslaagde visuele test voorgesteld.

Rollback betreft deze ontwikkelcommit. Nieuw opgeslagen bronbewijs en bestaande vooraf vastgelegde voorspellingen worden niet herschreven. De expliciete rechtenbeslissing blijft leidend voor daadwerkelijke activering van Milaan.
