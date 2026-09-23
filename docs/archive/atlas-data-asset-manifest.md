# Atlas cold-data asset manifest

Status: **COLD ARCHIVE — NIET AAN KOERSPLEIN RUNTIME GEKOPPELD**

Vastgelegd op 2026-09-23 vóór definitieve ontmanteling van Atlas.

## Doel

Atlas is geen actieve applicatie of databron voor Koersplein. De oude Atlas productiedatabase bevat echter omvangrijke, potentieel waardevolle onderzoeksdata. Deze manifestatie bewaart alleen de vindbaarheid en betekenis daarvan. Er is bewust **geen automatische import, databaseverbinding, workflowtrigger of runtime-afhankelijkheid** toegevoegd. Hergebruik mag alleen via een afzonderlijke, gevalideerde migratie naar het Koersplein-datamodel.

## Bewaarde externe bron

Render PostgreSQL: `atlas-production-db`
Render resource id: `dpg-da8lf8qjnfac73epeu70-a`
Regio: Frankfurt
Opslag: 15 GB
Status tijdens inventarisatie: available

De database blijft voorlopig als read-only/cold archive bestaan zodat waardevolle data niet verloren gaat bij het verwijderen van de oude Atlas-site en -code.

## Belangrijkste aantoonbaar aanwezige datasets

Rijtellingen zijn PostgreSQL-statistiekschattingen uit `pg_stat_user_tables`; ze zijn bedoeld als inventarisatie, niet als exact reconciliatierapport.

| Dataset | ca. rijen | Mogelijk nut voor Koersplein |
|---|---:|---|
| historical_return_labels | 14.268.996 | historische uitkomsten / modelvalidatie |
| atlas_price_v2_canonical | 4.109.924 | gecanonicaliseerde historische prijzen |
| atlas_price_v2_raw | 4.092.199 | bron-/reconciliatiebewijs voor prijzen |
| historical_monthly_prices | 3.993.830 | lange historische maandreeksen |
| historical_universe_membership | 1.998.200 | point-in-time universum / survivorship-bias controle |
| historical_feature_snapshots | 1.901.432 | point-in-time features voor backtests |
| security_identifiers | 1.637.241 | identifier mapping / entity resolution |
| historical_month_end_observation_quality | 1.344.588 | datakwaliteit |
| daily_prices | 1.289.770 | historische dagkoersen |
| historical_corporate_actions | 747.113 | corporate-action controles |
| market_price_history | 544.136 | aanvullende koershistorie |
| atlas_machine2_company_priors | 290.100 | onderzoeksfeatures |
| atlas_machine2_touch_outcomes | 290.100 | historische uitkomsten |
| sec_pit_issuer_facts | 186.168 | point-in-time fundamentals |
| prediction_lab100_historical_forecasts | 145.200 | bevroren historische voorspellingen |
| prediction_lab100_outcomes | 133.400 | gerealiseerde forecast-uitkomsten |
| global_securities | 25.757 | wereldwijd effectenuniversum |
| global_companies | 23.179 | bedrijfsuniversum |
| atlas_public_forecasts | 18.169 | historische publieke forecast-ledger |

Daarnaast zijn tabellen aanwezig voor lifecycle evidence, SEC/fundamentals, corporate actions, source provenance, universe coverage, forecast components, calibration, research evidence en kwaliteitscontroles.

## Hergebruikregels

1. Nooit rechtstreeks lezen vanuit de Koersplein-productieruntime.
2. Eerst exporteren naar een afzonderlijke staging/importlaag.
3. Identiteit koppelen op stabiele identifiers (ISIN/MIC waar beschikbaar), niet alleen ticker/naam.
4. Point-in-time timestamps en bronherkomst behouden.
5. Geen Atlas-modelscore of voorspelling als Koersplein-feit overnemen.
6. Elke dataset vóór promotie testen op duplicaten, look-ahead bias, survivorship bias, corporate actions en datumdekking.
7. Alleen gevalideerde gegevens promoveren naar bestaande Koersplein D1/R2-schema's.
8. De cold archive database pas verwijderen nadat gewenste datasets aantoonbaar zijn geëxporteerd en gereconcilieerd.

## Ontmantelingsgrens

De oude Atlas-code, website en automatisering zijn niet nodig voor dit archief. Alleen de databank blijft tijdelijk behouden als gecontroleerde bron. Dit voorkomt dat Atlas-code/workflows opnieuw door Koersplein gaan lopen en voorkomt tegelijk verlies van miljoenen historische observaties.
