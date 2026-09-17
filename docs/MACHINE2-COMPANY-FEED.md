# Machine 2 — historische bedrijfsvoeding

Doel: per historische voorspeldatum reconstrueren welke bedrijfsinformatie werkelijk beschikbaar was.

## Bronnen
1. AFM register financiële verslaggeving: jaarlijkse en halfjaarlijkse rapporten plus deponeringstijd.
2. AFM ESEF/XHTML/XBRL voor machineleesbare IFRS-cijfers vanaf de ESEF-periode.
3. Euronext company press releases voor resultaten, guidance, winstwaarschuwingen, dividend, M&A en andere gereglementeerde informatie.

## Harde regels
- reporting period is nooit de publicatiedatum;
- een latere restatement overschrijft het oorspronkelijke datapunt niet;
- ontbrekend is UNKNOWN, nooit nul;
- alleen exact aan een instrument gekoppelde issuer-records mogen trainen;
- bron-ID/hash en beschikbaarheidstijd blijven aan ieder datapunt gekoppeld;
- wanneer alleen een publicatiedatum en geen betrouwbaar tijdstip bekend is, wordt voor intraday-toepassing conservatief de volgende handelssessie gebruikt;
- Machine 2 mag hypotheses vormen; Machine 1 leert pas na onafhankelijke blinde validatie.

## Signalen
Revenue, operating income, net income, EPS, operating margin, free cash flow, cash, net debt, dividend, guidance, guidance changes en profit warnings. De signal engine bewaart zowel niveau als verandering ten opzichte van het vorige destijds bekende datapunt.

## Volgende schaalstap
Bouw een issuer↔ISIN mapping voor alle Amsterdamse instrumenten, haal AFM/ESEF filing metadata en documenten batchgewijs op, parseer originele tags en koppel daarna Euronext events. Start met de pilotbedrijven, valideer handmatig een kleine steekproef op publicatiemoment en schaal daarna naar alle 124 Amsterdamse instrumenten.
