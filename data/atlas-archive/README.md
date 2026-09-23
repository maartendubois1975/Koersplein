# Atlas Research Archive

Dit is een **quarantainelaag** voor bruikbare historische Atlas-data.

- `raw/`: onveranderde exports; nooit door de publieke site of actuele Top-5 gelezen.
- `normalized/`: naar Koersplein-contract omgezette records.
- `validated/`: alleen records die de validator doorstaan.
- `manifests/`: batch-, schema- en reconciliatiebewijzen.

Geen bestaande Koersplein-data wordt overschreven. Promotie naar actief onderzoek vereist een aparte expliciete stap.

De grote datasets worden niet in Git opgeslagen. Git bewaart alleen contracten/manifests; bulkdata hoort in de afzonderlijke research-archive storage (R2 of een andere expliciet geconfigureerde objectstore).
