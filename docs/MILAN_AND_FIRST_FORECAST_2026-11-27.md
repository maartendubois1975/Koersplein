# Milaan en eerste vooraf vastgelegde voorspelling — 27 november 2026

## Geleverde software en bewijs

De bestaande streamingparser voor Euronext Trade Files heeft een optionele detailcontrole voor MTAA/EXGM. Deze telt regulier orderboek, dark en buitenboek apart, bindt transacties aan ISIN/MIC/valuta/sessie en voorkomt dubbeltelling van identieke transactie-ID's. Conflicterende transactie-ID's stoppen de controle. Wijzigingsmeldingen blijven beoordelingsplichtig. De laatste tien minuten en slotfase worden als onderzoeksinformatie opgeslagen. Slotfase omvat mogelijk trading-at-last en wordt daarom niet automatisch als slotveiling aangemerkt. Gelijke tijdstempels met verschillende laatste prijzen worden als ambigu geregistreerd. De normale import is ongewijzigd.

De nieuwe reconciliatie vergelijkt de volledige bestaande selectie van 360 ondernemingen met de officiële, niet-aangepaste dagelijkse tabel. Het bewaarde dossier bevat 360 bronrespons-hashes, de hash van het volledige transparantiebestand en reproduceerbare echte transacties voor A2A, Alia Mentis, Banca Profilo, EdiliziAcrobatica en KME. Het zijn onderzoeksgegevens, geen nieuw gepubliceerd koersarchief.

| Sessie 26 november | Aantal |
|---|---:|
| Bedrijven in selectie | 360 |
| Met transacties in transparantiebestand | 309 |
| Exact overeenkomend totaalvolume | 309 |
| Exacte OHLCV-overeenkomst zonder ambigue laatste volgorde | 293 |
| Exacte overeenkomst met ambigue laatste transactievolgorde | 1 |
| Verschil in slotprijsdefinitie | 15 |
| Officiële tabel met nulvolume en geen gevonden transacties | 51 |

Bij alle 309 verhandelde identiteiten komen open, hoog, laag en totaalvolume overeen. Voor A2A bestaat het verschil tussen orderboekvolume en officieel totaal uit 17.086 dark-aandelen. Bij Alia Mentis betreft het 30.751 buitenboek-aandelen. EdiliziAcrobatica heeft een officiële slotreferentie van 1,055, gelijk aan de berekende VWAP in de laatste tien minuten, terwijl de laatste transactie 1,06 is. Voor de overige gevallen wordt geen afrondingsregel of slotkoers verzonnen. Een nulvolume-waarneming wordt niet omgezet in een OHLC-bar.

## Gratis bron en toelatingsbeslissing

Bronnen zijn gratis bereikbaar. De [Trade Files-voorwaarden](https://marketdata.euronext.com/data-reporting-service/trades-file) vereisen bronvermelding en de voorgeschreven disclaimer bij verspreiding. Clausule 7 vereist een overeenkomst bij vergoeding of commercieel voordeel. Het afschaffen van de vergoeding voor bepaalde Milanese After Midnight-data vanaf oktober bewijst geen automatische toestemming voor het afzonderlijke historische AJAX-endpoint. Zie ook [officiële overeenkomsten](https://connect.euronext.com/en/data/market-data-agreements), [prijsdefinities](https://www.borsaitaliana.it/azioni/legenda.en.htm) en artikel 5.4 van het [Trading Manual](https://www.euronext.com/sites/default/files/2025-10/trading_manual_-_311025_-_avd_ordersdark_post-onlyhybrid_model__0.pdf).

Milaan blijft daarom een cataloguspreview met 360 geselecteerde ondernemingen. De nieuwe bron is niet als publicatiebron toegelaten. Resterend bewijs: slotdefinitie voor de uitzonderingen, historische brondekking en expliciete toepasbaarheid van gratis herpublicatierechten op Koersplein. Er is geen abonnement afgesloten of handmatige importworkflow gestart. Oslo en de overige onderzoeksbeurzen worden door deze wijziging niet toegelaten.

## Prospectieve voorspelling

De bestaande forecastlezer kan nu een afzonderlijk beoordeeld venster gebruiken. De beslissing geldt alleen voor de exacte peildatum, identiteit, EUR-valuta en broninhoud. De oorspronkelijke geschiedenis blijft byte voor byte behouden. Een ontbrekende sessie, veranderde bronbar, andere peildatum of gewijzigde beoordeelde waarde blokkeert toelating. De centrale Euronext-kalender heeft daarvoor de officieel gepubliceerde sluitingsdagen van 2025 gekregen.

Voor Adyen en Basic-Fit zijn alle 253 open sessies van 1 december 2025 tot en met 26 november 2026 vergeleken met verse officiële N- en Y-tabellen. Beide bronmodi leveren hetzelfde venster. Alle slotprijzen en volumes zijn bevestigd; float32-weergaveverschillen gebruiken de bestaande strikte equivalentie. Drie echte hoog/laagverschillen zijn expliciet beoordeeld en alleen in het tijdelijke modelvenster vervangen: Adyen laag 15 september, Basic-Fit hoog 11 maart en laag 4 mei. Koersarchieven worden niet herschreven. De beschikbare bedrijfsmededelingen zijn gecontroleerd op splitsingen en claimrechten; hashes en gebeurtenissen zijn vastgelegd. Dit is een prospectief prijsvenster, geen bewijs voor een totaalrendementreeks of een historische constituententest.

De bestaande consensusformule is ongewijzigd. De normale dagelijkse onderzoeksingang heeft op 27 november om 06:32:01 Nederlandse tijd, vóór de Amsterdamse opening, Basic-Fit verzegeld op basis van de bekende slotkoers van 26 november, 31,28 EUR. Onderzoeksdoel: +30% binnen drie maanden, einddatum 26 februari 2027. Het cohort telt uitsluitend twee van 80 Amsterdamse ondernemingen (2,5%). De eenvoudige benchmark is het vooraf vastgelegde gelijkgewogen prijsrendement van Basic-Fit en Adyen. Het is geen volledige marktindex of uitvoerbare transactiestrategie; kosten, dividend en de eerstvolgende uitvoeringsprijs zijn niet verwerkt.

De selectie heeft hash `b1bc97fd10aa67a6739ecb581d08e33fb319a0a7da658c6ff075e319c03b1aae`. Het dossier bewaart invoerhash, modelversie, oorspronkelijke rangorde, cohort, benchmark en echte vastleggingstijd. De twee oudere onverzegelde records blijven ongewijzigd en worden uitgesloten van de resultaatstatistiek. Huidige meetbare evaluatie: één verzegelde voorspelling, nul afgerond, slagingspercentage/rendement/verlies nog niet bepaalbaar. Een ongewijzigde herhaling mag geen tweede selectie toevoegen. Nieuwe peildagen vereisen nieuwe bronbeoordeling.

## Acceptatie en publicatie

Lokale acceptatie omvat npm test, audit:codebase, history:test, alle researchtests en de vastgelegde Paris-selectiecontrole. De nieuwe regressies gebruiken echte brongevallen voor volumeopbouw, slotreferentie, deduplicatie en beide 253-sessievensters, plus negatieve wijzigingen aan identiteit, datum en bronwaarden. De bestaande 899 ondernemingen, centrale archieven en vijf dagsessies blijven behouden.

De wijziging gaat uitsluitend naar consolidation-20261116. De bestaande geplande testpublicatie behoudt haar eigen veiligheidscontroles. De laatst waargenomen testversie is b3e2cb2, Render-deploy dep-dc47u0d9el5s73ag70d0. Nieuwe code is pas live na een afzonderlijk bewezen geslaagde publicatie. Rollback betreft deze ontwikkelcommit; een reeds vooraf geregistreerde onderzoeksvoorspelling blijft als auditwaarneming bewaard. Main, productie en Cloudflare zijn niet gewijzigd.
