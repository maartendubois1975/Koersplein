# Amsterdam history: evidence-led triage (2026-10-30)

Source: staging GitHub Actions history-quality artifact, 41 price-jump cases and 33 gaps. This document is a triage, not a verification of prices or a release approval.

## Newly established structural findings

- **Ten different securities share the exact same 39-calendar-day missing interval, 1996-03-25 to 1996-05-03:** Aegon, Akzo Nobel, Corbion, Heineken, ING, KPN, Philips, Randstad, RELX, Wolters Kluwer. This synchronized pattern is a strong indicator of a shared upstream data-coverage gap, not ten independent trading suspensions. Verify historical sessions from an independent source; do not fill prices by interpolation.
- The 41 >50% price jumps are concentrated in 12 named issuer series: Ease2pay (9), Pharming (8), Almunda (6), Alumexx (6), Vivoryon (4), Shell (2), and six other issuers (1 each). Thus 33/41 jumps belong to only five issuer series, making issuer-lineage and provider normalization more valuable than 41 isolated manual fixes.
- **Current identifiers on old historical bars require point-in-time identity verification.** In particular, the dataset labels a 1997 observation as SHELL PLC, ISIN GB00BP6MXD84. Do not assume the modern security identity and listing history apply unchanged to those old observations. Check original issuer/security lineage before calculating long-horizon returns.
- The source's request parameter `adjusted=Y` is not proof of which corporate actions are covered or of dividend-reinvested total returns. Euronext's trading manual allows corporate-action adjustments subject to conditions, and adjusted reference prices are not interchangeable with a validated total-return series.

## Source-specific next actions

1. Compare Euronext Y/N response pairs on available dates using `scripts/research/compare-euronext-adjustment-modes.mjs`; capture HTTP failures as failures, not as evidence of identical series.
2. Reconcile the ten shared 1996 gaps as a single provider-coverage incident, then individually verify remaining gaps.
3. Validate security identity by effective date, not just present-day ISIN, especially historical Shell and corporate transformations.
4. Keep chart-only display separate from investable, point-in-time, total-return backtesting; leave forecasting disabled until corporate actions, survivorship, delistings, price source and licensing are verified.

No price was fabricated or rewritten by this triage.
