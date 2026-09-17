# Uitvoeringsfase — blok 1 t/m 3

Status: uitvoerpijplijn gebouwd; scheduler OFF.

## Blok 1 — historische databank
Alle nieuwe data kan nu door één harde PIT-feedpoort. Accepted, quarantine en rejected worden apart geteld; dekking per familie/entiteit/periode is meetbaar. Bestaande prijsdata wordt hergebruikt. Externe historische fundamentals, consensus, nieuws, short/flows en verdwenen fondsen mogen uitsluitend als 'gevuld' gelden nadat echte records door deze poort zijn gekomen.

## Blok 2 — tijdmachine
Maandelijkse snapshots reconstrueren uitsluitend de vintage die op cutoff T aantoonbaar beschikbaar was. Iedere snapshot krijgt een manifest, evidence-ID-set en hash. Latere revisies kunnen eerdere snapshots niet wijzigen.

## Blok 3 — Machine 1 massarunner
Voor ieder instrument in een snapshot worden 3/6/12/24-maands kansverdelingen gemaakt en samen met modelversie, snapshotHash en evidenceIds bevroren. Uitkomsten kunnen pas daarna gekoppeld worden.

## Belangrijke grens
Dit bouwblok claimt niet dat alle externe historische bronnen al zijn binnengehaald. De architectuur/pijplijn is uitvoerbaar, maar echte dekking moet door runs worden gemeten. De huidige `machine1-pit-baseline-v2` is een technisch probabilistisch baseline-model, geen bewezen alpha-model; Machine 3/4 moeten later aantonen of een challenger werkelijk beter is.

## Volgende uitvoeringswerk
De pijplijn voeden met echte Amsterdamse PIT-records en coverage-rapporten produceren; daarna de maandelijkse tijdmachine over de beschikbare geschiedenis materialiseren en de massarun uitvoeren. Dit gebeurt batchgewijs met checkpoints/resume en zonder automatische scheduler totdat activering expliciet wordt toegestaan.
