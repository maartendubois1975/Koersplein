# Milaan — officiële IPO-/transfer-reconciliatie (2026-11-21)

**Geen import; status: ONDERZOEK.** Gecontroleerd tegen bestaande historische `data/euronext-milan.json` (opgehaald 2026-09-29) en officiële Euronext IPO/transfer-kalender.

Officiële bron: https://live.euronext.com/it/markets/milan/ipos (bevat ook transfers, niet alleen nieuwe ondernemingen). Ondersteunende IPO-bron: https://www.borsaitaliana.it/azioni/distribuzione-diretta/operazioni/page.en.htm

| Bedrijf | ISIN | Officiële datum | Historische catalogus | Onderzoeksbeslissing |
|---|---|---|---|---|
| Orange Media Group | IT0005733040 | 2026-09-30 | **Ontbreekt** | Nieuwe notering na snapshot; kandidaat toevoegen aan te controleren lijst, nog NIET goedgekeurd |
| Nabla | IT0005730384 | 2026-09-21 | Aanwezig | Geen nieuwe onderneming uit dit event |
| I.CO.P. | IT0001214433 | 2026-09-04 | Aanwezig | Geen nieuwe onderneming uit dit event |
| Intred | IT0005337818 | **2026-11-23** | Aanwezig | Toekomstige markttransfer; NIET vóór ingangsdatum als nieuwe hoofdmarkt tellen, niet dubbel opnemen |

## Belangrijke bevindingen
- Officiële Euronext Milan gereglementeerd: **201 instrumenten**; Growth: **234 instrumenten** (momentopnamen, geen bedrijfsregister). https://live.euronext.com/it/markets/milan/equities/euronext/list en https://live.euronext.com/it/markets/milan/equities/growth/list
- Growth toont onder meer 4AIM SICAF en een converteerbare obligatie van ABC Company. Marktlabel alleen bewijst dus geen gewone aandelen van operationele ondernemingen. https://www.borsaitaliana.it/borsa/azioni/euronext-growth-milan/lista.html
- De oude 401-regelige gefilterde catalogus is **niet compleet voor 2026-11-21**: ten minste Orange Media Group ontbreekt. Het verschil tussen 401 en 435 is geen zuivere netto-toename van ondernemingen (bruto versus gefilterd; tijdsverschil, transfers en andere instrumenttypen).
- Voor iedere onderneming eerst bewijs van actuele notering en hoofdbeurs; de IPO-pagina toont expliciet ook transfers, dual listings en mergers. De vermelding 'Milan' alleen is onvoldoende voor de primaire-marktregel.

## Nog nodig voor definitieve invoering
1. Download de volledige actuele officiële lijst voor beide segmenten inclusief pagina 2 en 3 en identiteiten, met vastgelegde momentopname.
2. Vergelijk alle actuele ISIN's met de historische 401, classificeer toevoegingen, verwijderingen, transfers, fondsen en instrumentklassen.
3. Leg per kandidaat primair-marktbewijs vast, inclusief multi-listings en hoofdmarktwijzigingen.
4. Voer een steekproef van historische OHLC en ontbrekende handelsdagen uit; test centrale regressie zonder andere vijf markten te veranderen.
5. Pas **na** complete audit en nul onbesliste inclusies in één transactie de centrale testbranch aan.
