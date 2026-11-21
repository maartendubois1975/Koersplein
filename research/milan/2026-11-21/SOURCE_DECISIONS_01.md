# Milaan — bronbeslissingen eerste tranche (2026-11-21)

**Status: onderzoeksbeslissingen; GEEN import.** Onderzoek betreft bestaande historische 401 instrumentregels uit data/euronext-milan.json (2026-09-29). Definitieve actuele officiële populatie en primair-noteringstoets nog open.

| ISIN | Naam | Voorlopige beslissing | Reden / bewijs |
|---|---|---|---|
| IT0005204729 | 4AIM SICAF | EXCLUDE | Beleggingsfonds / SICAF, geen gewone operationele onderneming. https://www.borsaitaliana.it/borsaitaliana/ufficio-stampa/comunicati-stampa/2021/2crowdfundingdi4aimsicafpdf.en.pdf |
| IT0005440323 | 4AIM SICAF COMP 2 | EXCLUDE | Compartiment van hetzelfde alternatieve beleggingsfonds, geen zelfstandig operationeel bedrijf. Zelfde officiële bron. |
| NL0000226223 | STMICROELECTRONICS (STMMI) | EXCLUDE_MILAN_SECONDARY | IPO en eerste notering in Parijs en NYSE in 1994, Milan-notering pas 1998. https://investors.st.com/resources/faqs ; https://www.sec.gov/Archives/edgar/data/932787/000093278726000009/stm-20251231.htm |
| NL0011585146 | FERRARI (RACE) | PENDING_PRIMARY | NYSE én Euronext Milan; officiële Euronext vermeldt Milan spin-off 4 januari 2016; primaire markt nog eenduidig bepalen. https://live.euronext.com/en/ipo-showcase/ferrari ; https://cdn.ferrari.com/download/Ferrari_Annual_Report_2024.pdf |
| NL00150001Q9 | STELLANTIS (STLAM) | PENDING_PRIMARY | NYSE, Milan en Paris; gelijktijdige Europese start 18 januari 2021; geen enkelvoudige primaire beurs vastgesteld. https://www.stellantis.com/en/investors/stock-and-shareholder-info/stock-info ; https://www.stellantis.com/content/dam/stellantis-corporate/investors/financial-reports/Stellantis-NV-20251231-Annual-Report.pdf |
| NL0015001OI1 / NL0015001OJ9 | MFE A / MFE B | PENDING_PRIMARY_DEDUP | Twee aandelenklassen van één issuer; hoogstens één ondernemingsrecord na hoofdbeursverificatie. |

## Bronbeleid
- Borsa Italiana A-Z bevat Global Equity Market (o.a. buitenlandse secundaire listings) en soms niet-aandelen zoals converteerbare obligaties: https://www.borsaitaliana.it/borsa/azioni/listino-a-z.html
- Growth-segmentlijst bevat 4AIM en converteerbare obligaties, dus beurssegmentlabel alleen is onvoldoende: https://www.borsaitaliana.it/borsa/azioni/euronext-growth-milan/lista.html
- Beoordeel **ieder** overgebleven instrument op actuele status, operationele onderneming, dubbele aandelenklassen en daadwerkelijke primaire beurs. Buitenlandse ISIN-code is geen automatische uitsluitingsgrond.
- Geen definitief aantal, geen wijziging company-register-contracts, geen testdeploy, geen productie.
