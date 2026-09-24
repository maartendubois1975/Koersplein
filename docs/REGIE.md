# Koersplein — Regieprincipes

Dit document legt de vaste beslisregels vast voor wijzigingen aan Koersplein. Het doel is niet om iedere opdracht automatisch uit te voeren, maar om de technisch beste en eenvoudigste oplossing voor de website te kiezen.

## 1. Regie boven instemming
Een voorgestelde wijziging is geen opdracht om blind te bouwen. Eerst wordt beoordeeld:
1. Is het beschreven probleem aantoonbaar aanwezig?
2. Lost de voorgestelde wijziging de oorzaak op, of alleen een symptoom?
3. Is niets wijzigen veiliger of eenvoudiger?
4. Introduceert de wijziging minder risico, complexiteit en onderhoud dan zij verwijdert?
5. Is er een kleinere oplossing met hetzelfde resultaat?

Als het antwoord onvoldoende positief is, wordt de wijziging niet uitgevoerd. Een gemotiveerd **nee** is een geldig en gewenst resultaat.

## 2. Bewijs vóór wijziging
Controleer eerst actuele main, canonical state en relevante workflowruns/logs. Geen architectuurwijziging uitsluitend op basis van een vermoeden. Een probleem moet reproduceerbaar of uit concrete run-/data-evidence afleidbaar zijn.

## 3. Minimaal noodzakelijke complexiteit
Voorkeur:
- één canonical state;
- één eigenaar/writer per persistent gegeven;
- één bewezen route boven meerdere overlappende routes;
- bestaande component verbeteren boven een parallel systeem bouwen;
- markt-specifieke adapters alleen waar bronverschillen dat noodzakelijk maken.

Meer workflows, bronnen, retries of gates zijn niet automatisch beter.

## 4. Fail local, progress global
Een defecte markt mag gezonde markten niet blokkeren. Onbetrouwbare markten worden met een concrete reden geïsoleerd. COMPLETE is alleen toegestaan na bewezen catalogus-, bron-, historie- en eindvalidatie.

## 5. Bronnenbeleid
Identiteit/catalogus komt bij voorkeur van de officiële beurs/exchange. Historische koersdata moet aantoonbaar voldoende dekking hebben. Brondiversiteit is nuttig als onafhankelijke validatie of fallback, niet als doel op zichzelf. Voeg geen extra provider toe zonder aantoonbare meerwaarde. Betaalde of juridisch onduidelijke bronnen worden niet stilzwijgend productie-afhankelijkheid.

## 6. Geen eindeloze retries
Retries zijn alleen voor plausibel tijdelijke fouten. Structurele catalogus-, mapping-, fingerprint- of bronfouten worden niet gemaskeerd door herhalen. Ze krijgen een diagnose en zo nodig quarantaine.

## 7. Wijziging moet zichzelf bewijzen
Na een wijziging:
- syntax/static audit;
- relevante regressiecontrole;
- controle van echte workflowresultaten wanneer beschikbaar;
- pas daarna mag de wijziging als bewezen verbetering gelden.
Een groene algemene audit is geen bewijs dat een nog niet uitgevoerde end-to-end datarun functioneel geslaagd is.

## 8. Verwijderen hoort bij bouwen
Wanneer een nieuwe route aantoonbaar de oude vervangt, wordt de oude route verwijderd of uitgeschakeld. Geen stapeling van historische oplossingen.

## 9. Gebruikersvoorstellen kritisch beoordelen
Wensen en observaties van Maarten zijn belangrijke input, maar niet automatisch de technische oplossing. Als een voorstel waarschijnlijk meer blokkades, risico of complexiteit veroorzaakt, leg dat uit en voer het niet uit zonder nieuwe reden/evidence.

## 10. Beslisvolgorde
**Observeer → bewijs oorzaak → vergelijk niets-doen/kleine fix/grote fix → kies kleinste robuuste oplossing → test → bewijs → behouden of terugdraaien.**

Deze principes zijn leidend bij toekomstige autonome Koersplein-wijzigingen en horen mee te wegen in code reviews, audits en automatische kwaliteitsregie.
