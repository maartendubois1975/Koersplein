# Vulblokken 1–3 Amsterdam — feitelijke status

De vulroute is nu gekoppeld aan echte officiële bronfamilies en een checkpointed coverage-runner. Dit document maakt bewust onderscheid tussen bron gevonden, adapter gebouwd en records daadwerkelijk gevuld.

## Blok 1 — historisch universum
Bestaande 124 Amsterdamse koershistories worden hergebruikt. Volledige historische delistings/faillissementen/overnames en historische indexleden zijn nog niet als compleet gemarkeerd. Euronext index back-history is een licentiepoort; zonder abonnement wordt die niet gefingeerd.

## Blok 2 — fundamentals
AFM Financial Reporting is de primaire openbare filing-index. De deponeringsdatum kan als harde beschikbaarheidsanker dienen; een eerdere issuer-publicatietijd geldt alleen wanneer die apart bewezen is. Werkelijke cijfers moeten per concept/periode/unit uit de onderliggende rapporten worden geëxtraheerd en door PIT gate gaan.

## Blok 3 — verwachtingen en buitenwereld
AFM short current/archive is bruikbaar als officiële publieke positioning-bron. ECB ondersteunt historische versies via includeHistory en is geschikt voor vintage-aware macro. Historische analistenconsensus blijft een licentie-/datatoegangsgat; guidance wordt niet met consensus vermengd. Historische Euronext index membership blijft license-gated.

## Definitie van klaar
Een vulblok is pas gevuld wanneer coverage.json echte accepted/quarantined/rejected aantallen bevat voor de gewenste periode en entiteiten. Adapter-code alleen telt niet als gevuld. Scheduler blijft OFF.
