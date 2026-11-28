# Parijs, sessiebewijs en Oslo — ontwerp 28 november 2026

Basis ae1c736, uitsluitend consolidation-20261116. De 899 bestaande
registeridentiteiten, modelvensters en verzegelde voorspellingen blijven intact.
Geen main, productie, Cloudflare-wijzigingen, handmatige workflow of deployment.

## Onderzoek vóór implementatie

Van 85 Parijse noteringen zonder centrale lokale historie hebben 57 een exacte
ISIN/MIC/symbool-koppeling in het bestaande Koersplein-manifest. Alle 57 bestaande
reeksen zijn read-only opgehaald. 54 bevatten samen 36.479 complete positieve
OHLCV-regels. Drie bevatten uitsluitend nulvolume-referenties. De overige 28
zijn reeds onderzocht; dat brononderzoek wordt niet opnieuw uitgevoerd.
De 54 reeksen spreken de bewaarde officiële laatste transactiedatum niet tegen.
Dit is hergebruik van bestaande opslag, geen toelating van een nieuwe databron
of verklaring van nieuwe herpublicatierechten. De externe opslag blijft intact.

Er zijn 135 kandidaat-sessies met een later bewaard officieel NO_TRADES-besluit,
waarvan de laatste transactiedatum vóór de onbevestigde sessie ligt. Alleen
dezelfde listing, gesloten kalenderdagen, maximaal zeven dagen terug en
ongewijzigd officieel bronbewijs komen in aanmerking. Opgeslagen handel,
identiteitswijzigingen en later gedateerde laatste transacties blokkeren.
Een retrospectief besluit krijgt de echte waarnemings- en beoordelingsdatum.
Het mag geen kennis vóór die datums suggereren.

Het officiële RomReal-prospectus bevat ISIN BMG 763301022 met spaties en
registratie 37382. Het actuele GLEIF-record verbindt dezelfde Bermuda-registratie
aan LEI 549300DHIW4W3OJW6A93. Dit voltooit de deterministische uitgeverbrug;
het bewijst op zichzelf geen operationele koers- of publicatierechten.

## Implementatie en acceptatie

De bestaande centrale archiver krijgt één gedeelde append-only documentfunctie
voor dag- en beoordeelde opgeslagen historie. Bronmanifest, prijsselectie,
identiteit, valuta, datum en bronhash worden vóór opslaan opnieuw gecontroleerd
onder de bestaande schrijflock. Geen vervanging van betrouwbare bestaande bars.
Nieuwe historische reeksen blijven onbevestigd voor corporate actions/modellen.

Een brongebonden sessiereview gebruikt dezelfde archiver om uitsluitend
onbevestigde besluiten te verbeteren; het volledige eerdere besluit blijft
als bewijs bewaard. De bestaande geplande verwerking en publicatiebeveiliging
blijven ongewijzigd. De grafiek toont uitsluitend complete handelsobservaties,
met vermelding van uitgesloten referentie-/onvolledige regels; raw brondata
worden niet verwijderd. Het statuspaneel gebruikt de werkelijke opgeslagen
reviewresultaten en geeft nog open gevallen expliciet weer.

Acceptatie met echte opgeslagen data: bron → gecontroleerde selectie → centrale
opslag → grafiek/status → blokkade voor ongeschikte modelinvoer. Negatieve proeven
wijzigen uitsluitend tijdelijke kopieën. Test idempotentie, gedeeltelijke
verwerking, bronhash-/identiteits-/valutawijziging en strijdig handelsbewijs.
Daarna alle bestaande regressies, historie-, audit- en onderzoekstests, Paris-
selectiecontrole en onafhankelijke GitHub-CI. Software rollback uitsluitend op
codepaden naar ae1c736; aangevulde betrouwbare data en bronbesluiten behouden.

## Resultaat

Werkelijk uitgevoerd: 54 Parijse historieprojecties met 36.479 complete positieve
OHLCV-regels in de bestaande centrale opslag toegevoegd. Alle 896 vooraf aanwezige
JSON-archiefbestanden bleven bytegelijk. De oorspronkelijke 191.205 bronregels
uit 57 documenten blijven in het gehashte, gecomprimeerde bewijs bewaard; nulvolume,
onvolledige en ambigue regels worden niet als handelsdagen ingevoerd/getekend.
Dit is structureel gecontroleerde brondata, geen onafhankelijke bevestiging van
corporate actions, prijsbasis of totaalrendement. Modeltoelating blijft geblokkeerd.

Van 135 eerste kandidaat-sessies voldoen 126 aan alle strenge voorwaarden:
Amsterdam 1, Brussel 11 en Parijs 114. De archiver heeft alleen die onbevestigde
besluiten verbeterd. Alle 9.449 reeds bevestigde besluiten en alle koersen zijn
behouden; afgeleide laatst-bevestigde-koersvelden mogen op echte bestaande bars
worden bijgewerkt. Elk eerder onbevestigd record is volledig in
priorUnverifiedEvidence behouden. Herhaling levert ALREADY_REVIEWED, zonder
nieuwe bronverzoeken of prijswijzigingen.

sessionSnapshotAt voorkomt dat een retrospectief besluit vóór knownAt als
vooraf bekende informatie wordt gelezen. Statusrapport en hergebruik door de
collector gebruiken deze centrale projectie. De tijd van het bronbewijs en de
latere beoordelingsdatum blijven apart zichtbaar. Dit verandert geen historische
koers, voorspelling, rendement of benchmark. Een nieuw plan is vereist als een
gedeeltelijke sessieopslag de oorspronkelijke inputhashes heeft veranderd;
er wordt niet blind over gewijzigde input heen geschreven.

De laatste Parijse sessie is via de bestaande archiver opnieuw afgeleid UIT het
al bewaarde sessiebestand, zonder collector of workflowstart. Zo kregen 55
ondernemingen een echte oudere lastConfirmedBar met datum. De dagbesluiten
bleven exact 510 verhandeld, 149 geen handel, 5 onbevestigd. Voor alle vijf
beurzen samen blijven op de laatste sessie zes gevallen onbevestigd.

### Werkelijk opgeslagen lokale dekking

| Beurs | Goedgekeurd | Met lokale historie | Complete unieke bedrijf/dagen | Onbevestigde opgeslagen sessies | Bevestigd zonder handel |
| --- | ---: | ---: | ---: | ---: | ---: |
| Amsterdam | 80 | 80 | 364.357 | 3 | 30 |
| Brussel | 105 | 105 | 2.180 | 21 | 69 |
| Parijs | 664 | 633 | 43.436 | 83 | 1.581 |
| Dublin | 16 | 16 | 3.863 | 4 | 9 |
| Lissabon | 34 | 34 | 6.983 | 0 | 53 |

Totaal 420.819 complete unieke bedrijf/dag-observaties en 111 nog onbevestigde
opgeslagen sessies. De 31 resterende Parijse gevallen bestaan uit de 28 eerder
onderzochte brongevallen en drie bestaande reeksen met uitsluitend nulvolume:
AROCA DEL PINAR, IGIS NEPTUNE en STUDENT PROPERTY. Geen van deze waarnemingen
bewijst automatisch dat nooit handel heeft plaatsgevonden. De ouderdom van
bewaarbare koersdata en onbekende noteringsstarts blijven expliciete beperkingen.
Deze telling is lokale builddekking, geen bewering over volledige externe opslag.

### Laatste onbevestigde dag en gratis bronroutes

Zes werkelijke officiële bronproeven voor 27 november zijn bewaard:
vier XMLI-referenties zonder laatste transactiedatum, geen bruikbare dagregel
voor Europlasma en een Irish Continental-quote waarvan de laatste transactie
20 november en waardering 23 november is. Niets daarvan bewijst een complete
27-novembersessie. Deze zes blijven dus open; er is geen veronderstelde handel,
opschorting of no-trade-status ingevoerd.

Het bestaande Milanese bron-/EMDA-onderzoek wordt hergebruikt. Nieuw vergeleken
alternatieven leveren geen onvoorwaardelijke gratis openbare archiefroute op:
Alpha Vantage beperkt de standaardtoelating tot persoonlijk niet-commercieel
gebruik; Twelve Data beperkt commerciële Free Tier-toepassing en externe
verspreiding; de officiële Stooq-pagina's waren door browserverificatie niet
leesbaar. De oude Borsa-after-midnight-clausule is geen bewezen actuele grant
voor deze endpoints en archief-/modeltoepassing. Geen accounts, betaalde bronnen,
ondertekende overeenkomsten of aanvragen gestart. Details en primaire URLs staan
in free-source-rights-review.json.

### Oslo

Het op 28 november opnieuw gelezen officiële register bevat dezelfde 292
noteringen. Alle 244 geselecteerde ISIN/symbool/segment/valuta-identiteiten matchen.
RomReal is via het exacte, met spaties gedrukte ISIN en registratie 37382 gekoppeld
aan het reeds bewaarde actuele GLEIF-record. Alle 244 hebben nu unieke LEI's.
Het prospectus zelf wordt niet herpubliceerd; alleen feitelijke identifiers en
bronhash zijn vastgelegd. De 243 eerdere voorstellen en oude onderzoeksbestanden
blijven behouden.

Oslo is als cataloguspreview voorbereid via de bestaande centrale contracten,
navigatie, kalender en toelatingsdiagnose. De actieve .markets-contracten blijven
exact gelijk en tellen 899 ondernemingen. XOSL is niet operationeel: een
goedgekeurde dagelijkse bronroute ontbreekt en gratis openbare rechten voor
Yahoo/Euronext zijn niet bewezen. Milaan blijft geblokkeerd op zijn eerder
vastgestelde publicatierecht. Geen beurs is op basis van alleen techniek geactiveerd.

### Controle en publicatie

Geslaagd: npm test, audit:codebase, history:test, Paris-selectiecontrole en alle
22 researchtestbestanden. Nieuwe integratieproef herhaalt het complete herstel
op echte bewaarde bronnen en test verkeerde valuta, gewijzigde bronhash,
schrijverconflict, herhaling, ongeschikte modelinvoer, uitgesloten referenties,
retrospectieve as-of-lezing en behoud van prijsbestanden. De echte statusrenderer
is ook met de nieuwe herstelmetingen, twee previews en 664 Parijse rijen getest.
De volledige voorspellingsledger is bytegelijk: twee verzegelde open voorspellingen,
nul afgerond. Geen modelverbetering of bewezen rendement geclaimd.

Bij read-only eindcontrole diende Render nog b3e2cb2 uit. De nieuwe commit en
onafhankelijke CI worden apart in de oplevering vermeld. Geen live acceptatie van
de ongepubliceerde versie geclaimd. Nieuwe publicatie blijft wachten op de
bestaande geplande exact-SHA-controle. Bewijs en testloghashes staan onder
research/completion/2026-11-28/source-block.
