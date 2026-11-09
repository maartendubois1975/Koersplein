# Bouwblok 1 — geverifieerde branch- en workflowinventaris
Datum: 2026-11-09. GitHub Git-tree en compare API; geen productie- of branchwijzigingen.

| Branch | Git tree SHA | Tracked blobs | Workflow(s) |
|---|---|---:|---|
| main | a2ddf4e85fba8c00fd96aaaf476570c20fc4f8c0 | 487 | amsterdam-candidates-scheduler.yml, amsterdam-staging-schedule.yml |
| amsterdam-reset-20261027 | 864b56a254d785bdbfd1f81724257b7eab907e77 | 604 | amsterdam-daily-history.yml |
| amsterdam-clean-20261031 | 099688b499d7fb37a78871b3c286ff4f5e37a7cd | 116 | amsterdam-clean.yml |
| codex/koersplein-home-history | f36cd82016be987ed5df30becd13a5a78999af15 | 582 | amsterdam-daily-history.yml |
| consolidation-single-pipeline-20261108 | a416f7e1c3a9d488c0197f00b3e63e4cc57e1c5a | 507 | main's two workflows plus consolidation-checks.yml |

**Belangrijk:** tellingen zijn aantallen blobs in de Git tree, geen live bestanden of runtime jobs. SHA's zijn momentopnames.

## Vergelijking
- `main...amsterdam-reset-20261027`: 354 commits ahead, 34 behind, 152 veranderde bestanden; branches zijn diverged.
- `main...amsterdam-clean-20261031`: 488 commits ahead, 34 behind, 300 veranderde bestanden; branches zijn diverged.
- `amsterdam-clean-20261031` mist de Brusselse Euronext-catalogus die op `main` aanwezig is. Deze branch is **geen geschikte volledige Europese basis**.
- `amsterdam-reset-20261027` bevat aanvullende Amsterdamse geschiedenis- en acceptatiescripts (onder andere `scripts/history/amsterdam-end-to-end-acceptance.mjs`, `scripts/history/audit-amsterdam-import.mjs` en `scripts/history/session-readiness.mjs`).
- `main` heeft twee workflows met verschillende checkout-doelbranches. De kandidatenworkflow is ingepland op werkdagen; de stagingworkflow is uitsluitend handmatig. Beide zijn aanwezig op de consolidatiebranch. Dit is een gedeelde bron van verwarring, maar niet bewezen dat beide tegelijk schrijven.
- Op de resetbranch is `.github/workflows/amsterdam-daily-history.yml` aanwezig; die is niet automatisch gelijk aan een actieve productiejob.

## Keuze en migratiestrategie
**Voorgestelde basis: `consolidation-single-pipeline-20261108`**, omdat deze op `main` voortbouwt en de Europese data en bestaande site behoudt. Niet `amsterdam-clean` als hele website overnemen.
1. Haal eerst de afzonderlijke Amsterdamse validatie- en acceptatiemodules uit `amsterdam-reset` over na modulevergelijking.
2. Breng daarna de waardevolle Amsterdamse catalogus-/historiewijzigingen over op basis van ISIN/MIC en provenance; nooit een volledige branch overschrijven.
3. Behoud de bestaande Brusselse catalogus op de basisbranch en audit die afzonderlijk.
4. Laat de twee bestaande Amsterdam-workflows ongemoeid totdat hun doelbranch en daadwerkelijke runresultaten zijn vergeleken.
5. Voer tests uit op de geconsolideerde code, vervolgens staging; pas daarna een expliciet voorstel om oude workflows te stoppen.

## Niet vastgesteld
- De volledige inhoudelijke juistheid van de 80 Amsterdamse en alle Brusselse noteringen.
- Welke Render-services en Cloudflare triggers live zijn, hun credentials of daadwerkelijke schrijfdoelen.
- Een volledige import of UI/forecast end-to-end run. GitHub CI alleen is daarvoor onvoldoende.

## Acceptatiestatus bouwblok 1
**Inventaris en basiskeuze: gereed.** Code-overname en volledige branchconvergentie: **niet gereed**. Geen onveilige merge of automatische verwijdering uitgevoerd.
