# Bouwblok 1 — Universeel Point-in-Time datamodel

Status: gebouwd als kerncontract v1.

## Opgeleverd
- Definitieve masterarchitectuur met 14 bouwblokken.
- Universeel PIT-contract voor identiteit, named signals, waarden/missing, vier tijdsdimensies, vintages/revisies, bron/rechten, kwaliteit en lineage.
- Centrale normalizer/validator.
- Cutoff-projector die de historische wereld reconstrueert zoals die op tijdstip T kenbaar was.
- Quarantaine voor onbewezen published/tradable times.
- Revisies blijven vintages en worden pas zichtbaar vanaf hun eigen tradableTime.
- Missing kan niet stilletjes nul worden.
- Afgeleide features kunnen parentEvidenceIds en transformatieketen bewaren.
- Zelftest voor toekomstlek, revisies, cutoff, quarantaine en missing.

## Definitie van klaar voor blok 1
Alle nieuwe voedingsadapters moeten naar `koersplein-pit-v1` normaliseren. Oudere Machine-2-feeds mogen tijdens migratie blijven bestaan, maar mogen uiteindelijk niet rechtstreeks Machine 1 voeden buiten deze PIT-poort.

## Volgende bouwblok
Blok 2: historisch aandelenuniversum — IPO, delisting, faillissement, overname, historische indexlidmaatschappen, naams/ticker/ISIN-identiteit en corporate actions zonder survivorship bias.
