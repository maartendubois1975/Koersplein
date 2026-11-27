# Brondefinities, achttien modelvensters en Oslo — 27 november 2026

## Opgeleverd

Dit bouwblok gebruikt commit 64c4f0b als basis. De vijf operationele registers blijven Amsterdam 80, Brussel 105, Parijs 664, Dublin 16 en Lissabon 34. De actieve koersmarkten blijven vijf. De centrale koersarchieven, dagelijkse sessies en het voorspellingsgrootboek zijn niet gewijzigd.

### Milanese slotprijsverschillen opgelost als brondefinities

De bestaande Euronext-parser kan optioneel de kolommen **Last** en **VWAP** naast de bestaande OHLCV lezen. De standaardimport geeft exact dezelfde bars terug. Alle 360 originele officiële responses voor 26 november zijn hergebruikt. De echte tabelfragmenten en oorspronkelijke responshashes staan in `research/completion/2026-11-27/milan-history-table-evidence.json.gz`.

De officiële laatste transactieprijs is voor alle 309 verhandelde ondernemingen teruggevonden onder de kandidaatprijzen van de laatste transactietijd. Het orderboek bevat soms meerdere prijzen met exact dezelfde tijd- en publicatietijdstempel. De bestandvolgorde bewijst dan niet welke executie als laatste moet gelden. De expliciete officiële Last-kolom neemt die ambiguïteit weg. Open, hoog, laag en totaalvolume zijn eveneens voor alle 309 bevestigd.

Bij zeven ondernemingen verschilt de officiële Close van de officiële Last: Banca Profilo, EdiliziAcrobatica, Emak, Energy, ErreDue, Expert.ai en Fumagalli. Voor Banca Profilo zijn dat 1,620 en 1,622. Dat zijn verschillende bronvelden, geen ontbrekende handelsdag. De officiële slotreferentie blijft bewaard. Het onderzoek berekent geen vervangende afrondings- of VWAP-prijs. De oude conservatieve vergelijking blijft als meetresultaat beschikbaar; de nieuwe `definitionStatus` legt de aanvullende bronbevestiging apart vast. Er zijn nul onopgeloste verschillen tussen de officiële Last en de aangetroffen laatste transacties. De 51 nulvolume-waarnemingen worden niet als uitgevoerde OHLCV opgeslagen.

Dit lost de onderzochte dagelijkse prijsdefinitie voor die sessie op. Het bewijst niet automatisch elke historische bar of iedere toekomstige sessie.

### Gratis rechten en operationele toelating

De [Trade Files-voorwaarden](https://marketdata.euronext.com/data-reporting-service/trades-file) zijn opnieuw gecontroleerd. Gratis gebruik en downloaden zijn toegestaan onder voorwaarden; verspreiding vereist de voorgeschreven bronvermelding en disclaimer. Bij commercieel voordeel geldt een overeenkomst. De officiële [marktdatawijziging voor juli/oktober 2026](https://connect.euronext.com/sites/default/files/documentation/data/Euronext%20Market%20Data%20Notice%20July%202026%20and%20October%202026_1.pdf?VersionId=UIqBEqXwf1Yt84shohrQRzmiqSjuvUgo) schrapt de vergoeding voor bepaalde Milanese After Midnight-data via EMDA/EDSA. Dat bewijst geen algemene toestemming voor het historische Live-AJAX-endpoint en een publiek Koersplein-archief. Zie ook [overeenkomsttypen](https://www.euronext.com/en/data/pricing-specs-agreements/data-agreements-types).

Milaan blijft daarom een preview van 360 beoordeelde ondernemingen. De bronroutes zijn nog niet operationeel toegelaten. Het bestaande contract mist bovendien de operationele navigatiebeschrijving en uitgever-ID's voor de nieuwe markt. De geselecteerde ondernemingen zijn niet opnieuw afgekeurd; dit betreft ontbrekende operationele toelatingsvelden. Er is geen nieuwe markt geactiveerd, licentie aangegaan, mail verzonden of betaald abonnement afgesloten.

## Voorspellingsinvoer van twee naar achttien

Van de 80 Amsterdamse ondernemingen waren 72 structureel bruikbaar op 26 november. De twee bestaande beoordeelde vensters zijn exact behouden. Voor de overige 70 zijn verse officiële N-waarnemingen vergeleken met het opgeslagen 253-sessievenster. Alleen 55 zonder conflict in opening, slot, volume of sessiedekking gingen door naar de afzonderlijke Y-, quote- en mededelingencontrole. Eén quoteverzoek liep vast. Alle bronbevindingen staan in `forecast-source-audit.json` en het herbruikbare bronbewijs in `forecast-source-evidence.json.gz`.

| Nieuwe controle | Aantal |
|---|---:|
| Volledig beoordeeld en afzonderlijk toegelaten | 16 |
| Aanvankelijke prijs-, volume- of sessieverschillen | 15 |
| Verschillen tussen N/Y of nader te beoordelen bedrijfsgebeurtenissen/mededelingen | 38 |
| Tijdelijke onvolledige bronrespons | 1 |
| Totaal nieuwe onderzochte ondernemingen | 70 |

Toegelaten zijn Acomo, Allfunds, ASM International, Azerion, BE Semiconductor Industries, ForFarmers, Flow Traders, Havas, Heijmans, IMCD, Randstad, Sif, TomTom, Triodos, TKH en Vopak. Met Adyen en Basic-Fit zijn dit 18 van 80 ondernemingen, 22,5%. Ieder venster bevat 253 gecontroleerde open sessies. Dit zijn samen 4.554 bedrijfsdagen in de modelvensters, geen 4.554 nieuwe archiefbars.

De nieuwe broncontrole gebruikt de bestaande geschiedenislezer, kalender, prijsvergelijking en vensterbeslissing. De CLI schrijft uitsluitend voorstellen:

```sh
node scripts/research/forecast-source-audit.mjs research/completion/2026-11-27/forecast-source-evidence.json.gz
```

De toegelaten beslissingen zijn afzonderlijk vastgelegd in `forecast-admission-decisions.json`. Volledige mededelingenlijsten zijn vereist; voor vier bedrijven zijn vervolgpagina's opgehaald. Kapitaalverhogingen, kapitaalverlagingen, optionele dividenden, onduidelijke gebeurtenissen en ontbrekende pagina's krijgen geen automatische goedkeuring. Hoog/laagverschillen worden alleen in het beoordeelde modelvenster geselecteerd. Openingskoersen, slotkoersen, volumes en oorspronkelijke archiefbars worden niet vervangen. Alle beslissingen gelden uitsluitend voor de peildatum 26 november. Nieuwere sessies vereisen nieuwe gecontroleerde bronbeoordeling.

De bestaande Basic-Fit-voorspelling blijft exact behouden met haar oorspronkelijke tweeledige benchmark en 2,5% cohortdekking bij vastlegging. Het grotere cohort is niet achteraf gebruikt om een betere voorspelling te kiezen. Er blijft één verzegelde voorspelling, nul afgeronde resultaten en geen bewezen slagingspercentage of modelverbetering. De consensusformule is ongewijzigd. Deze venstercontrole levert geen totaalrendementreeks, historische constituententest of bewezen handelsstrategie op.

## Oslo en Europese volgorde

De verse officiële Oslo-export van 27 november bevat dezelfde 292 instrumentidentiteiten en symbolen als de eerdere beslissingen. Heder Bank is opnieuw gecontroleerd. De eerste afgesloten XOSL-sessie op 26 november heeft echte OHLCV, ISIN NO0013774166 en NOK-valuta. De voorlopige blokkade “eerste sessie nog niet afgesloten” is vervallen. De gecontroleerde onderzoeksselectie stijgt van 243 naar **244** ondernemingen; 45 blijven uitgesloten en drie gevallen blijven open. Alle eerdere 243 kandidaten zijn exact behouden in het nieuwe gedateerde dossier. Deze selectie is niet operationeel toegelaten.

De eerdere rangschikking wordt hergebruikt: Oslo, Madrid, Wenen, Stockholm, Helsinki, Kopenhagen, Frankfurt/Xetra, Zürich en Londen. Oslo blijft technisch het verst voorbereid. Voor de andere acht is in dit blok geen nieuw definitief ondernemingtotaal vastgesteld. De onderliggende per-beursbevindingen en rechtenblokkades staan in `EUROPEAN_SCALING_2026-11-26.md`; ze worden niet als nieuw onderzoek gepresenteerd.

## Status en acceptatie

De centrale toelatingscontrole kan nu alle blokkades teruggeven. De bestaande assert gebruikt dezelfde eerste fout en blijft de operationele ingang beveiligen. De statuspagina toont bij Milaan de werkelijke ontbrekende operationele velden en rechten naast de bronproef van 309 bevestigde volumes en laatste prijzen. Het bronproefbestand is met een SHA-256 aan het previewcontract gebonden; een gewijzigd bestand wordt niet als bewezen status getoond. Dit activeert geen prijsfeed.

De bestaande registerregressie controleert de oorspronkelijke catalogusvelden ongewijzigd en toetst de toegevoegde bronproefverwijzing afzonderlijk tegen haar werkelijke hash. Nieuwe regressies gebruiken de 360 echte tabellen, de echte Heder-sessie, de 16 toelatingsbeslissingen en gewijzigde identiteits-, datum-, bron- en kapitaalgebeurtenisgevallen. De verplichte volledige lokale keten en GitHub-CI worden afzonderlijk gerapporteerd.

Bij live controle diende de testsite nog b3e2cb2 uit. De eerdere commit 64c4f0b heeft een geslaagde GitHub-regressie 45946816411. Er is geen handmatige importworkflow, service of deployment gestart. De nieuwe code wacht op de bestaande geplande testpublicatie en haar controles. Rollback kan deze ontwikkelcommit terugdraaien; de reeds vastgelegde eerste voorspelling blijft als onderzoekswaarneming behouden. Main, productie en Cloudflare zijn ongewijzigd.

Aanvullende acceptatie: de werkelijke statusrenderer is uitgevoerd met het volledige opgeslagen rapport. De test bevestigt vijf beursregels, omschakelen tussen 80 Amsterdamse en 34 Lissabonse ondernemingen, de bronproef, blokkades en voorspellingstabellen. Visuele desktop-/mobielacceptatie van deze nieuwe versie is nog niet uitgevoerd: de omgeving had geen werkende Chromium-engine en de officiële browserdownload gaf HTTP 403. Dit is niet als geslaagde visuele controle geregistreerd. De nieuwe code staat nog niet op de testsite.
