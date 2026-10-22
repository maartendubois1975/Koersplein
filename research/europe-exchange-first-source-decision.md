# European exchange-first data sourcing — independent decision gate

Date: 2026-10-22
Status: research / no production cutover authorized

## Objective
Replace per-instrument multi-provider retries with exchange-level daily OHLCV ingestion, while preserving existing stored history and listing identities.

## Source candidates
- **Euronext Web Services** (official): documented REST/JSON delivery for quotes, trades, historical and reference data. Candidate for XPAR, ALXP, XMLI, XBRU and other Euronext markets. Commercial redistribution and pricing **not yet verified**.
  Source: https://www.euronext.com/en/data/how-access-market-data/web-services
- **EODHD exchange-level APIs**: independent coverage probe in `scripts/cloudflare/eodhd-bulk-coverage-pilot.mjs`. Requires `EODHD_API_TOKEN`. No verified live coverage or redistribution grant yet.
- **Stooq**: **not approved** as Koersplein production feed: personal-use/redistribution restrictions and unreliable automated access reported.
- **Existing providers**: retain only as diagnostic/targeted fallback until licensed exchange-wide sources are verified.

## Mandatory acceptance criteria before any production switch
1. Obtain provider permission for Koersplein's intended public display and redistribution.
2. Confirm coverage against the *current* official ISIN+MIC universe; distinguish share classes and multiple listings.
3. Confirm at least one closed trading date for each exchange; verify open/high/low/close/volume, currencies, trading calendars, no-trade status, and corporate-action adjustment conventions.
4. Run in read-only mode and produce per-market coverage and discrepancy reports.
5. Demonstrate append-only imports on an isolated test dataset and audit unchanged existing partitions.
6. Switch one exchange at a time with rollback to the previous importer; never delete history or fabricate missing bars.

## Current evidence and blockers
- Existing 2026-10-22 run 39725079803: 7,051 catalog entries, 5,860 current OHLC, 447 verified no-trade, 744 missing OHLC, 730 failed imports.
- EODHD pilot script and manual workflow are committed, but have **not** run against authenticated market data.
- Official Euronext Web Services pricing, permissions and API access are not established.
- No claim of complete European coverage or operational replacement is warranted.

## Implementation boundary
Keep the production daily workflow and storage unchanged until a source passes the acceptance criteria. A source's public website or technically accessible endpoint is not evidence of redistribution rights.
