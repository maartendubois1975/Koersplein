# Koersplein Event Target Engine

## Doel
Koersplein onderzoekt niet primair gewone koersstijgingen en -dalingen. De kernvraag is: **welke vooraf herkenbare toestand verhoogt de kans dat een aandeel binnen een bepaalde toekomstige periode een vooraf bepaalde koersbarrière aantikt?**

De onderzoekseenheid is daarom een `TARGET_EVENT`, niet een willekeurig maandrendement.

## Targets
Voor ieder aandeel en ieder strikt point-in-time startmoment T worden koerspaden onderzocht voor meerdere horizons en barrières.

Standaard positieve barrières: +5%, +10%, +20%, +30%, +50%, +100%.
Standaard negatieve barrières: -5%, -10%, -20%, -30%, -50%.
Standaard horizons: 1 maand, 3 maanden, 6 maanden, 12 maanden, 24 maanden.

Een target is geraakt zodra de koers **op enig moment binnen de horizon** de barrière bereikt. Dit is bewust anders dan alleen het rendement op de einddatum.

Per target bewaren we minimaal:
- instrument/ISIN en historische identiteit;
- starttijd T en startkoers;
- horizon en barrière;
- `hit=true/false`;
- eerste datum/tijd waarop de barrière werd geraakt (`firstTouchAt`);
- aantal handelsdagen tot de eerste touch;
- maximum favorable excursion binnen de horizon;
- maximum adverse excursion vóór de touch en over de hele horizon;
- eindrendement op de horizon;
- markt-/sectorrelatieve en abnormal-return varianten;
- corporate-action/koerskwaliteit-controle;
- liquiditeit/omzet/volatiliteit;
- volledige PIT-data-lineage.

## Episodes, geen dubbeltellingen
Opeenvolgende maandelijkse startpunten die feitelijk dezelfde koersbeweging beschrijven worden naast de ruwe observaties samengevoegd tot een `TARGET_EPISODE`. Daardoor blijven zowel statistisch bruikbare startmomenten als economisch afzonderlijke rally's/crashes beschikbaar. Eén rally mag niet ten onrechte als meerdere onafhankelijke ontdekkingen worden gepresenteerd.

## Deep Event Forensics
Ieder belangrijk target-event, te beginnen met +30% binnen 3 maanden, krijgt een diep dossier. Machine 2 onderzoekt de wereld vóór T op 1 dag, 1 week, 1 maand, 3 maanden, 6 maanden, 12 maanden en waar zinvol langer terug.

Te onderzoeken families omvatten onder andere:
- prijs, momentum, versnelling, volatiliteit, volume en liquiditeit;
- sector, peers, klanten/leveranciers en relatieve sterkte;
- fundamentals en veranderingen daarin;
- consensus, analistenrevisies, earnings/guidance/surprises;
- management, kapitaalallocatie, insider-/short-/flow-/optionsignalen waar rechtmatig beschikbaar;
- nieuws, aandacht, zoek/sociale signalen met bewezen historische beschikbaarheid;
- rente, inflatie, FX, grondstoffen, krediet, liquiditeit en regimes;
- politiek, beleid, centrale banken en geopolitiek als objectief getimede externe variabelen;
- corporate events zoals overnamebod, strategische transactie, goedkeuring, product/event, emissie of buyback.

Machine 2 mag informatie ná T gebruiken om achteraf te verklaren wat werkelijk gebeurde, maar mag die nooit retroactief als voorspellende informatie aan Machine 1 geven.

## Contrafactuele controle
Een +30%-beweging is niet automatisch bedrijfsspecifieke voorspelbaarheid. Voor elk event vergelijken we met markt, sector en passende peers. We bewaren raw return én abnormal/relative return. Event-study methodiek en buy-and-hold abnormal return kunnen worden gebruikt afhankelijk van horizon. Hierdoor leren we onderscheid maken tussen 'alles steeg' en een werkelijk bijzonder aandeelssignaal.

## Van ontdekking naar voorspelling
1. Event Target Engine labelt historische target-events strikt zonder toekomstige informatie in de features.
2. Machine 2 onderzoekt hits, misses en vergelijkbare non-events diep.
3. Een gevonden patroon wordt uitsluitend een hypothese.
4. Machine 3 probeert die hypothese te falsificeren op onaangeraakte perioden/markten met purged/embargoed walk-forward validatie en robuuste inferentie.
5. Machine 4 vergelijkt challenger versus champion. Alleen aantoonbare out-of-sample verbetering mag Machine 1 veranderen.
6. Machine 1 geeft uiteindelijk per aandeel gekalibreerde kansen per barrière/horizon, plus onzekerheid en downside.

## Website-uitvoer
Voorbeeldstructuur, pas publiceren wanneer statistisch gevalideerd en databron/licentie dit toestaat:

- Kans +10% binnen 3 maanden
- Kans +20% binnen 3 maanden
- Kans +30% binnen 3 maanden
- Kans -20% binnen 3 maanden
- Historische basiskans markt/universum
- Kans onder vergelijkbare historische toestanden
- Belangrijkste positieve en negatieve drivers
- Onzekerheid/data-kwaliteit/modelversie
- Downside vóór een eventuele target-hit

Dit zijn kansen, geen garanties of koopadviezen.

## Onderzoeksprioriteit
Eerste hoofdtarget: `UP_30_WITHIN_3M`.
Daarna systematisch de volledige horizon × barrière-matrix. Extreme gebeurtenissen krijgen diepere forensische prioriteit dan gewone bewegingen, maar non-events en mislukkingen blijven noodzakelijk als controlegroep.

## Onbreekbare regels
- `within horizon` betekent eerste barrière-touch binnen de periode, niet alleen eindrendement.
- Geen future leakage.
- Geen survivorship bias.
- Splits/corporate actions en foutieve extreme koersen eerst valideren.
- Missing is nooit nul.
- Geen verklaring achteraf promoveren tot voorspeller zonder onafhankelijke test.
- Geen target-hit gelijkstellen aan een winstgevende strategie: transactiekosten, drawdown, liquiditeit en uitvoerbaarheid worden apart gevalideerd.
- Alle voorspellingen en modelversies worden bevroren en auditbaar opgeslagen.
