# Parijs — bedrijvenonderzoek en historische aansluiting

Onderzoeksdatum: **16 november 2026**. Branch: `paris-reset-20261116`. Uitgangscommit: `9b9e20eb521972c2256559150eb5967dec535aea`.

## Resultaat en betekenis

Alle **769 oorspronkelijke noteringen** hebben een afzonderlijke beslissing, reden en bronverwijzing in **`company-decisions.json`**. Dat is de centrale bron van waarheid. CSV-bestanden en het onderzoekscatalogusbestand worden uitsluitend daaruit geëxporteerd.

| Segment | Opnemen | Uitsluiten | Apart/onbeslist | Onderzocht |
|---|---:|---:|---:|---:|
| Euronext Paris / XPAR | 295 | 37 | 5 | 337 |
| Euronext Growth Paris / ALXP | 246 | 44 | 3 | 293 |
| Euronext Access Paris / XMLI | 123 | 7 | 9 | 139 |
| **Totaal** | **664** | **88** | **17** | **769** |

**664 is de onderbouwde onderzoeksselectie, geen verklaring dat het volledige Parijse universum zonder onzekerheden definitief vaststaat.** De 17 open gevallen tellen niet mee. Een individuele hoofdmarktconclusie is waar aangegeven een gevolgtrekking uit officiële notering, instrumentidentiteit, bedrijfsinformatie en onderzoek naar concurrerende noteringen. Niet voor iedere onderneming is een expliciet Market-of-Reference-veld uit een officiële masterfile beschikbaar. Dit staat per rij in `primaryEvidenceBasis` en `primaryConclusionIsInference`; een productpagina met ISIN alleen is geen zelfstandig hoofdmarkt- of activiteitsbewijs.

Er is geen nieuwe runtime-bedrijvenlijst ingevoerd. `approved-research-catalog.json` is een onderzoeksresultaat voor gecontroleerde latere integratie, geen automatisch publiceerbaar productiecontract.

## Hergebruikt onderzoek

De volgende bestaande werkzaamheden zijn als uitgangspunt gebruikt, niet opnieuw uitgevoerd alsof er geen onderzoek bestond:

* Actions-run **43809738322**, inventaris en opslagcontrole, commit `2777828afd74d286539067c71c1024698730df00`, artifact **14199718657**.
* Actions-run **43810891249**, workflow `.github/workflows/paris-evidence-review.yml`, commit `9b9e20eb521972c2256559150eb5967dec535aea`, artifact **14200033747**.
* De volledige originele artifact-ZIP's zijn onder `evidence/` bewaard, zodat het dossier niet afhankelijk is van het verlopen van Actions-artifacts.
* Bestaande broncatalogus, instrumentclassificatie, opslagidentiteitsresolver, Parijse follow-policy, herstel-/diagnosescripts, onderzoeksfabriek en relevante workflows zijn gelezen.
* De eerdere goedgekeurde 80 Amsterdamse en 105 Brusselse ondernemingen en hun bronverwijzingen zijn hergebruikt voor de tien beschermde andere-hoofdmarktgevallen.
* De oude onderzoeken `parijs_definitief_onderzoeks_en_herstelplan.md`, `parijs_pilot_onderzoeksconclusie_2026-10-19.md` en `parijs_53_bronfouten_rapport_2026-10-19.md` zijn gelezen. De eerdere onderscheiding tussen transacties, waarderingssluitingen, gedeelde orderboeken en bronfouten blijft gelden.

Belangrijke correctie: de eerdere scanner vond de menu-items **Bid-Only trading status** en **Suspended instruments** op vrijwel elke pagina. Dat zijn navigatielabels, geen instrumentgebonden status. Ze zijn niet gebruikt om ondernemingen uit te sluiten.

Aanvullend is ieder van de 769 ISIN/MIC-combinaties individueel opgevraagd voor productmetadata, instrumentkenmerken, bedrijfsprofiel en quoteblok. Bij technische fouten is een tweede taalversie gebruikt. Vastgelegde positieve resultaten: **750** productidentiteiten, **727** instrument-factsheets, **694** bedrijfsprofielen en **727** quoteblokidentiteiten. Een mislukte bronaanvraag is geen bewijs van afwezigheid, geen handel of liquidatie. De aparte bronsoorten hebben verschillende dekking; hun aantallen mogen niet worden opgeteld als aantallen bedrijven.

## Uitsluitingen en uitzonderingen

De 88 uitsluitingen bestaan uit:

| Grond | Aantal |
|---|---:|
| Rechten/warrants/BSA | 42 |
| Aandelencertificaten, inclusief Robertet CI/CDV | 15 |
| SES Fiduciary Depositary Receipt | 1 |
| Tweede/preferente aandelenklasse | 2 |
| Andere hoofdbeurs: eerder goedgekeurd Amsterdam/Brussel | 10 |
| Andere hoofdbeurs: aanvullend gevonden | 15 |
| Gerechtelijke liquidatie of expliciet beëindigde activiteit | 3 |
| **Totaal** | **88** |

De vijftien aanvullend vastgestelde andere hoofdmarkten betreffen Apollo Minerals, Apex Critical Metals, Biosenic, Coty, EdiliziAcrobatica, Energy Solar Tech, Facephi, Kompuestos, Lleida.net, Making Science, Maroc Telecom, Racing Force, SEIF, SEGRO en ZCCM. Biosenic wordt hiermee niet aan het beschermde Brusselse register toegevoegd; het is uitsluitend een Parijse uitsluitingsbeslissing.

Altamir blijft opgenomen als echte investeringsholding. Een subtype `Others`, buitenlandse vestigingsplaats, vastgoedactiviteit of gebrek aan dagelijkse handel is op zichzelf geen uitsluitingsgrond. Ardoin Saint Amand B en Exxita-preferent worden niet als extra onderneming geteld; de gewone aandelenklasse vertegenwoordigt de onderneming.

De 17 open gevallen staan volledig in `pending-cases.csv`: **AKOM, MLALV, MLASO, MLCOR, MLDYN, MLEAV, ALEUA, MLGNS, ALKLN, MLMGL, MLMIB, SLCO, ALIE, STLAP, STMPA, MLTRO en CV**. Per geval staan reden en bronnen in het register. Voor Stellantis, STMicroelectronics en Kaleon is geen unieke hoofdmarkt afgedwongen op basis van nationaliteit of woordvolgorde. Verouderde transactiedata zijn aanleiding voor nader activiteitenonderzoek, niet automatisch bewijs van een geschrapte onderneming.

## Controle op ontbrekende ondernemingen

De oorspronkelijke export is opnieuw vergeleken met de officiële brede Parijse directory. Die brede directory gebruikt ook **XPMC**, de Parijse handelsplaats voor andere valuta. Dat levert **771 handelsregels, maar dezelfde 769 unieke ISIN's** op. De twee extra regels zijn **Accor USD / ACMC** en **Eiffage USD / FGRMC**. Deze zijn als aanvullende dubbele valutalijnen uitgesloten en apart vastgelegd, buiten de noemer van 769.

Binnen deze twee actuele officiële directories is dus geen aanvullende unieke onderneming gevonden. Dit is een controleerbare directoryvergelijking, geen absolute garantie dat iedere externe publicatie of aankomende beursgang al in de directory is verwerkt. De twee actuele CSV-exports staan onder `evidence/`.

Het verschil met de oude broncatalogus is hergebruikt: acht toevoegingen, negen verwijderde oude identiteiten en vijf naam-/tickerwijzigingen. D.A.T.E. en N4 Group zijn echte nieuwe beursgangen. De overige toevoegingen omvatten nieuwe rechten, WDP's nevennotering en twee nieuwe ISIN's. De negen oude identiteiten zijn afzonderlijk gearchiveerd in `archivedBaselineRows`, inclusief vijf geschrapte ondernemingen (Adeunis, Fiducial Office Solutions, Infoclip, Installux en Perseida Renta), twee vervangen ISIN's en twee verwijderde rechten/warrants. Een afwezige directoryrij wordt niet zonder meer als liquidatie benoemd.

## Historische gegevens — aanwezigheid is geen validatie

De bestaande auditbasis blijft ongewijzigd: **744 oude noteringen met gemelde historie, 3.316.652 gemelde koersregels**. Dit is een opslagregistertelling, geen onafhankelijke validatie van alle bars of bronrechten.

Voor de **664 opgenomen ondernemingen**:

| Historische toestand | Ondernemingen |
|---|---:|
| Exacte opslagidentiteit met gemelde historie; volledige bars niet opnieuw geaudit | 632 |
| Oude opslagidentiteit, in quarantaine voor bron-/beursidentiteit | 17 |
| Geen historie onder huidige identiteit, exclusief de twee ISIN-opvolgers | 13 |
| Nieuwe ISIN-opvolger zonder huidige opslagidentiteit | 2 |
| **Totaal** | **664** |

De huidige opgenomen selectie vertegenwoordigt volgens het manifest **3.036.634 gemelde regels**, inclusief de onbruikbare/nog niet toewijsbare oude reeksen. Dat aantal mag niet als gevalideerde Parijse OHLC-dekking worden gepresenteerd.

De vijftien huidige identiteiten zonder gemelde historie zijn **ALALO, MLBIM, ALDAT, MLESV, MLEXX, MLGL, MLHA2, MLIME, MLKPS, MLMED, ALN4, ALPRG, MLSJA, MLURC en MLVIC**. Voor ALALO en ALPRG bestaat wel oudere, afzonderlijk bewaarde historie onder de vorige ISIN's.

### Alle 28 oude opslagidentificaties daadwerkelijk gelezen

Voor elk van de 28 is de feitelijke publieke history-respons opgehaald en vergeleken met de manifestidentiteit. De aantallen daadwerkelijk gelezen bars stemmen per reeks overeen met het manifest. Uitkomst:

* **27** hebben een andere opgeslagen beurscode dan de onderzochte Parijse notering, meestal `XMIL`, in twee gevallen `XLUX`.
* **18** Spaanse reeksen bevatten slechts **één** regel, met **open = 0** en **volume = 0**. Dit is geen valide OHLC-reeks. Geen openingskoers invullen, geen waarderingssluiting tot transactie promoveren.
* **9** andere oude reeksen bevatten meerdere bars maar hebben een andere beurs-/leveranciersidentiteit. Hun identiteit, eventuele gedeelde orderboeken en bronherkomst vereisen onderzoek voordat ze aan Parijs mogen worden gekoppeld.
* De resterende reeks is **Lepermislibre DS**: een oud inschrijvingsrecht met één regel, niet de gewone aandelenhistorie.

Per reeks staan opgeslagen instrument, sleutel, provider, werkelijke aantallen, foutclassificatie en response-hash in `legacyHistoryAudit`. Geen van deze data is verplaatst, verwijderd of aangepast. De datums en bar-aantallen bewijzen geen herdistributierechten of economische vergelijkbaarheid.

### Gewijzigde ISIN's

| Onderneming | Oude ISIN | Nieuwe ISIN | Ingang | Oude aandelen per nieuw aandeel |
|---|---|---|---|---:|
| Acheter-Louer.fr | FR0014011O84 | FR001401B5X2 | 10-11-2026 | 10.000 |
| Prologue | FR0010380626 | FR001401AOZ5 | 15-10-2026 | 100 |

De acties zijn onderbouwd met emittentpublicaties en officiële noteringsgegevens. Het zijn relaties tussen afzonderlijke identiteiten; geen toestemming om ruwe reeksen automatisch aan elkaar te plakken of te vermenigvuldigen.

Bij Prologue staan **acht bars vanaf 15 oktober 2026** nog onder `ALXP:FR0010380626`, hoewel toen de nieuwe ISIN gold. De nieuwe ISIN ontbreekt in het manifest. Dat moet eerst aan de hand van bron en gebeurtenisgrens worden hersteld. Zowel de bare als de beursgebonden oude opslagidentiteit bestaan bovendien voor beide ondernemingen. Geen van die reeksen is samengevoegd of overschreven.

## Technische afronding voor de bestaande chat

1. **Onderzoekscatalogus gecontroleerd aansluiten.** Gebruik `company-decisions.json` en zijn INCLUDE-selectie; introduceer geen tweede handmatig onderhouden bedrijvenlijst. De runtimebron `data/euronext-paris.json` bevat nog de oude 770 regels en is hier bewust niet vervangen. Beslis hoe de 17 onbesliste gevallen zichtbaar en niet importeerbaar blijven.
2. **Bestaand registercontract uitbreiden.** `data/company-register-contracts.json` en `scripts/history/company-register.mjs` beschermen nu Amsterdam en Brussel. Voeg Parijs met segmenten en identiteitdigest toe zonder de 80/105-contracten te wijzigen. Laat de oude directory-fetcher geen goedgekeurde selectie overschrijven.
3. **Historische identiteit en lineage.** Hergebruik `storage-identity.mjs`; autoriseer geen ISIN-only-fallback naar de 27 verkeerde beursidentiteiten. Behandel de 18 ongeldige enkele regels apart. Maak bij de twee ISIN-wijzigingen expliciete gebeurtenissen met ingangsdatum en bron, en onderzoek Prologue's acht verkeerd gelabelde bars vóór een eventuele correctie. Bewaar altijd de oude ruwe data en rollback.
4. **Importbeleid herzien.** `config/paris-follow-policy.json`, `paris-active-universe.mjs`, `paris-history-eligibility.mjs` en `paris-targeted-history-recovery.mjs` gebruiken bestaande-historie-geschiktheid. Dat bewijst geen actieve onderneming of volledige dekking en slaat nieuwe identiteiten over. Gebruik eerst de onderzoeksselectie en daarna een afzonderlijke, gecontroleerde geschiedenis-/dagimportbeslissing.
5. **Bronkwaliteit.** Los ontbrekende huidige reeksen en brontoewijzingen op. Houd `TRADE_OHLC`, waarderings-/referentiesluitingen en corporate-action-aangepaste reeksen gescheiden. Geen verzonnen OHLC, geen gepromoveerde nulvolume-referentiekoersen en geen automatische providerfallback bij prijsverschillen.
6. **Eén validatieblok en testwebsite.** Verifieer het uiteindelijke bedrijfregister, source-routing, opslag, manifest/API en `generic-market.js`/`share.js` gezamenlijk. Bewijs actuele open/slot-datums en werkelijke bars per toegelaten bedrijf. Controleer Render-branch/deployment en website pas bij die technische stap. Deze onderzoekssessie heeft geen Render- of browseracceptatie uitgevoerd.
7. **Dagelijks draaien afzonderlijk aantonen.** De twee onderzochte Parijse workflows zijn read-only onderzoek; een succesvolle run daarvan is geen dagelijks koersimportbewijs. GitHub schedules op een ontwikkelbranch zijn niet automatisch actief. Wijzig `main` of productie hiervoor niet stilzwijgend.

## Validatie, bewaring en rollback

Uitgevoerd:

```bash
node scripts/research/export-paris-company-review.mjs
node scripts/research/export-paris-company-review.mjs --check
npm run history:core:test
```

De registercontrole toetst alle 769 identiteiten, segmentaantallen, beslissingen, bronverwijzingen, dekking van individueel bewijs, uniciteit van onderneming/ISIN/ticker voor de selectie, de 28 werkelijk gelezen reeksen, de twee ISIN-relaties en overeenstemming van alle afgeleide bestanden. De bestaande historische kern-, sessie- en consolidatieregressies slagen, inclusief bescherming van de exacte 80/105-bedrijvenlijsten, providerroutering en read-only status.

Er is geen nieuwe GitHub Actions-validatie, Render-uitrol, dagelijkse import of productiepublicatie geclaimd. Alleen nieuwe onderzoeksbestanden en één export-/controleprogramma zijn toegevoegd. `validation.json` registreert de tests, oorspronkelijke bestandshashes en de toegestane wijzigingsscope.

Rollback: verwijder/revert uitsluitend deze onderzoekscommit op `paris-reset-20261116`. Omdat geen runtimecatalogus, workflow, historische koersfile, database of deployment is aangepast, is er geen datamigratie terug te draaien.

## Bestanden

* `company-decisions.json`: centrale 769-regelige beslissingstabel, negen oude identiteiten, twee valutalijnen, lineage en alle 28 oude-reeksaudits.
* `included-companies.csv`: de 664 geselecteerde ondernemingen met redenen, bronnen en historische toestand.
* `excluded-listings.csv`: de 88 uitgesloten noteringen met redenen en bronnen.
* `pending-cases.csv`: de 17 onbesliste gevallen.
* `all-listings.csv`: alle 769 beslissingen voor spreadsheetcontrole.
* `approved-research-catalog.json`: automatisch afgeleide selectie voor latere technische integratie.
* `summary.json`: herberekende aantallen en dekkingssamenvatting.
* `evidence/individual-evidence.json.gz`: per ISIN/MIC bronvelden, retrievaldatums, bronhashes en korte bewijsfragmenten. Lossless gzip; uitlezen met `gzip -dc` of Node `gunzipSync`.
* `evidence/paris-manifest-snapshot.json.gz`: alle relevante bare en beursgebonden opslagidentiteiten; geen kopie van miljoenen historische bars.
* `evidence/inventory-run-43809738322.zip` en `evidence/decision-run-43810891249.zip`: ongewijzigde originele eerdere onderzoeksartifacts.
* De twee officiële directory-CSV's: vergelijking 769 unieke ISIN's versus 771 valutahandelsregels.
* `HANDOFF.md`: kopieerbare overdracht voor de bestaande Koersplein-chat.
