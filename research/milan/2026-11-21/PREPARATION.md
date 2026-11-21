# Koersplein — volgende beurs: Milaan (vooronderzoek 2026-11-21)

Status: VOORBEREIDING, niet aangesloten. Bestaande vijf markten en 899 bedrijven ongemoeid laten. Werkbranch consolidation-20261116. Geen productie-/main-/Cloudflare-wijzigingen.

## Praktisch databeleid
- TRADED: uitsluitend koersbalk met verifieerbare transacties en sessiedatum.
- NO_TRADES: behoud laatst bevestigde koers en toon oorspronkelijke koersdatum; geen kunstmatige OHLC voor een nieuwe handelsdag.
- SESSION_UNVERIFIED: geen verzonnen koers; onderneming blijft in register; uitzondering blokkeert de overige markt niet.
- Geen hard stop op een beperkt aantal illiquide aandelen, wel signalering en auditspoor.

## Volgende kandidaat: Borsa Italiana / Euronext Milan
- Officiële aandelenlijst: https://www.borsaitaliana.it/listino-ufficiale.en.htm
- Officiële gereglementeerde markt: https://live.euronext.com/it/markets/milan/equities/euronext/list (toonde 201 instrumentregels op 2026-11-21; dit is GEEN goedgekeurd ondernemingsaantal).
- Marktstructuur: https://www.borsaitaliana.it/azioni/mercati/mercati-landingpage/mercati.en.htm — Euronext Milan (incl. STAR), Euronext Growth Milan (incl. Professional), Euronext MIV.
- Brede instrumentlijst: https://live.euronext.com/en/markets/milan/equities/list — bevat ook andere instrumenten/markten, dus niet ongefilterd importeren.

## Vervolgcontrole voor aansluiting
1. Onderzoek bestaande register-/providerarchitectuur en eventuele reeds aanwezige Milan-vermeldingen; bouw geen parallel systeem.
2. Verkrijg officiële, complete lijsten per gekozen segment, filter aandelen versus ETF/ETN/warrants/rechten/fondsen, dedupliceer op markt+ISIN en valideer bedrijfsaantallen.
3. Proef per segment OHLC/handelsdag en ontbrekende handelsdagen, inclusief bron- en licentievoorwaarden.
4. Pas uitsluitend na goedkeuring het centrale contract en bestaande universele dagverwerking aan; tests eerst, alleen testdeployment bij passende SHA en geldige credentials.

## Niet als voltooid claimen
Geen complete gecontroleerde Milaan-catalogus, koersbronproef, testdeploy of live-HTTP-verificatie uitgevoerd. De vier XMLI-uitzonderingen van Parijs blijven afzonderlijk zichtbaar en blokkeren niet.

## Harde toelatings- en publicatievoorwaarden (bevestigd door opdrachtgever)

**Onderzoek eerst volledig; pas daarna één geïntegreerde invoering. Geen tussentijdse gedeeltelijke imports of live-publicatie.**

1. Alleen echte, actieve, individueel identificeerbare beursgenoteerde ondernemingen met aandelen (equity); sluit ETF's, ETN's, fondsen, obligaties, warrants, rechten, certificaten zonder zelfstandig bedrijf en andere niet-aandelen uit.
2. **Milaan is de primaire/hoofdbeursnotering** van de onderneming. Alleen een secundaire, cross- of dual listing op Milaan is onvoldoende. Controleer per twijfelgeval de primaire handelsmarkt via officiële uitgevende-instelling- en beursbronnen; vestigingsland of ISIN-landcode is niet doorslaggevend.
3. Eén onderneming één record, ook bij meerdere aandelenklassen, tickers of segmentvermeldingen. Bewaar relevante alternatieve instrumenten apart indien nodig; tel niet dubbel.
4. Onderzoek eerst de volledige officiële populatie en de relevante segmenten (Euronext Milan, STAR, Euronext Growth Milan, Professional en MIV alleen waar echte ondernemingsaandelen kwalificeren). Maak controleerbare inclusie-, exclusie- en twijfelgevallenlijsten met bronverwijzingen en expliciete redenen.
5. Valideer per goedgekeurde onderneming ten minste officiële naam, ISIN, ticker, MIC/segment, status, primaire notering en bron/bewijsdatum. Leg grensgevallen voor vóór goedkeuring; geen aannames bij ontbrekend bewijs.
6. Controleer representatieve dagelijkse OHLC- en historische bronproeven, handelskalender en statusafhandeling. Een handelsdag zonder transactie is geen reden om een geldig bedrijf te verwijderen; oude koersen mogen nooit als nieuwe transacties worden voorgesteld.
7. **Integratiepoort:** pas na compleet onderzoeksrapport, sluitende aantallen, nul onbesliste toelatingsgevallen en geslaagde tests één samenhangende wijziging op de bestaande centrale architectuur in werkbranch consolidation-20261116. Geen afzonderlijke of gedeeltelijke import, geen nieuwe parallelle infrastructuur, geen productie/main/Cloudflare-wijzigingen.
8. Publiceer uitsluitend naar de bestaande testomgeving nadat de exacte SHA en deploymentvoorwaarden zijn gecontroleerd. Live-HTTP-controle apart vastleggen; niet claimen als niet uitgevoerd.

## Laatste verificatiepoging 2026-11-21
- Officiële A-Z is bereikbaar: https://www.borsaitaliana.it/borsa/azioni/listino-a-z.html . Deze lijst mengt Milanese ondernemingen, Global Equity Market en andere instrumenten; kan niet als goedgekeurde ondernemingslijst worden gebruikt.
- De officiële volledige Euronext CSV-download via https://live.euronext.com/en/product_directory/data/stocks-milan/download?mics=XMIL%2CMTAA%2CEXGM is vanuit deze onderzoeksomgeving niet toegankelijk. **Geen volledige actuele reconciliatie bewezen**.
- De historische catalogus (401 gefilterde instrumentregels) blijft uitsluitend onderzoeksbasis; 398 instrumentregels zijn nog niet definitief toegelaten/afgewezen.
- Blokkeer XMIL-contract, import en deploy tot actuele officiële lijst plus bewijs primaire beurs en één onderneming per issuer compleet zijn. Geen gedeeltelijke of onbewezen aansluiting.
