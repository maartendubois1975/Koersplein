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
