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


## 11. Lerende regie: extern patroon, lokaal bewijs
De regie onderhoudt zichzelf als een control plane boven de uitvoerende machines. Zij mag bewezen operationele patronen uit volwassen softwareplatforms overnemen, maar nooit blind kopiëren. Een extern patroon wordt eerst vertaald naar het concrete Koersplein-risico en alleen ingevoerd als de extra complexiteit aantoonbaar gerechtvaardigd is.

Te toetsen patronen:
- observability met concrete gezondheids- en resultaatmetingen;
- kleine, omkeerbare wijzigingen met beperkte blast radius;
- canary/progressive uitvoering vóór brede uitrol wanneer de wijziging risico draagt;
- automatische rollback of quarantaine naar de laatst bewezen goede toestand;
- foutbudget: bij te veel operationele fouten gaat betrouwbaarheid vóór nieuwe functionaliteit;
- post-incident learning: unieke storingen krijgen oorzaak, impact, oplossing en bewijs van herstel;
- expliciete ownership: canonical state en persistentie hebben één eigenaar/writer.

De regie leert dus niet door steeds méér automatisering toe te voegen, maar door gemeten uitkomsten te vergelijken met eerdere beslissingen.

## 12. Beslislogboek en terugkoppeling
Voor materiële architectuurwijzigingen hoort de regie een beknopt machineleesbaar beslisrecord te kunnen bewaren met: probleem/evidence, overwogen alternatieven, gekozen of afgewezen wijziging, verwacht resultaat, risico/blast radius, rollback-pad en later het gemeten resultaat. Afgewezen voorstellen zijn eveneens waardevolle kennis: dezelfde slechte oplossing hoeft niet opnieuw onderzocht te worden tenzij de omstandigheden aantoonbaar veranderden.

Een eerdere beslissing mag automatisch worden hergebruikt voor diagnose, maar niet blind voor uitvoering. Eerst moet worden gecontroleerd of foutfingerprint, component en omstandigheden voldoende overeenkomen.

## 13. Stabiliteit heeft voorrang
Wanneer recente wijzigingen nog niet end-to-end bewezen zijn, worden niet zonder noodzaak nieuwe architectuurlagen gestapeld. Bij een verhoogd foutpercentage of terugkerende regressies gaat de regie tijdelijk in stabiliteitsmodus: nieuwe optimalisaties pauzeren, oorzaak isoleren, bekende goede toestand herstellen en pas daarna verder verbeteren.

## 14. Van begeleide doorbraak naar herhaalbare beursfabriek
Wanneer een begeleide sessie aantoonbaar sneller tot een werkende markt leidt, wordt niet alleen het losse probleem opgelost. De regie abstraheert de bewezen werkwijze naar de bestaande beursfabriek, zodat de volgende markt dezelfde beslisroute automatisch kan volgen.

Na iedere nieuwe of herstelde beurs:
1. leg vast welke stap werkelijk blokkeerde en welke evidence dat bewees;
2. onderscheid markt-specifieke bronlogica van generieke orkestratie;
3. verplaats alleen het bewezen generieke patroon naar de bestaande universele componenten;
4. voeg geen tweede workflow, scheduler, state of writer toe als de bestaande fabriek kan worden uitgebreid;
5. laat de volgende markt eerst catalogus/source-preflight doorlopen en ga daarna zonder menselijke tussenstappen door zolang alle gates groen blijven;
6. bij een structurele fout: stop alleen die markt, registreer reden/fingerprint en ga met andere bewezen markten verder;
7. beschouw handmatige begeleiding als trainingsdata voor de regie: een terugkerende handmatige aanwijzing is een signaal om te onderzoeken welk generiek beslispunt nog ontbreekt.

Doel: niet sneller worden door controles over te slaan, maar door bewezen controles en herstelbeslissingen één keer goed in de fabriek vast te leggen. De regie stuurt op complete beurzen en end-to-end resultaat, niet op aantallen losse reparaties of groene deelstappen.

