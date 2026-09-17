# Machine 2 voedingsstatus

## Gebouwd
- Universeel point-in-time evidence-schema.
- Bronregister met bronrangorde en licentie-/vintagebeleid.
- Harde trainingspoort: zonder bewezen publicatie- en beschikbaarheidstijd geen training.
- Officiële ECB-connector voor eerste macro/FX-inname; actuele historische observaties gaan bewust in quarantaine totdat historische beschikbaarheid/vintage bewezen is.
- Revisies blijven afzonderlijke records; UNKNOWN is nooit nul.

## Volgende voedingslagen
1. Bedrijfsfundamentals en guidance uit oorspronkelijk gedateerde issuer/regulatory filings.
2. Euronext/AFM events, corporate actions, indexhistorie en shortdata waar historisch beschikbaar.
3. ECB reeksen met bewezen release/vintage-semantiek: rente, FX, krediet en monetair regime.
4. Eurostat macro alleen met afzonderlijk bewezen historische publicatietijd/vintage; de gewone dissemination API is latest-version en dus niet automatisch PIT-veilig.
5. Markt/sector/volume/volatiliteit uit de bestaande koershistorie, als afzonderlijke named signals.
6. Analistenconsensus, revisions, opties, flows en complete nieuwsarchieven alleen via bron met voldoende historische timestamps en gebruiksrechten.

## Niet toegestaan
- Een huidige gereviseerde waarde terugplaatsen alsof die vroeger bekend was.
- Een observatiedatum verzinnen als publicatiedatum.
- Ontbrekende data als 0 opslaan.
- Machine 2 direct Machine 1 laten aanpassen zonder blinde validatie.

## Definitie 'af'
Machine 2 is technisch af wanneer nieuwe bronnen via hetzelfde schema kunnen worden toegevoegd, elke evidence door de PIT-gate gaat, analyses named signals gebruiken, hypotheses discovery/validation gescheiden houden en alleen bewezen OOS-signalen als leervoorstel naar Machine 1 mogen. De databank zelf blijft daarna permanent uitbreidbaar.
