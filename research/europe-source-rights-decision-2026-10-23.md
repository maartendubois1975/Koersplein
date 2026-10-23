# Europe source decision: EODHD and SIX (2026-10-23)
**Status: source access / redistribution not verified. Do not import into public production.**

## Primary discovery
- EODHD's documented eod-bulk-last-day endpoint provides a complete exchange/day snapshot, costs 100 API-call credits per request, and is not included in the Free plan. A date request on a nontrading day can return a different prior trading day; always verify every returned bar date. https://eodhd.com/financial-apis/bulk-api-eod-splits-dividends
- EODHD Terms state nonprofessional users cannot redistribute, display, resell or retransmit data, even repackaged. Koersplein is a public-facing website, so a separate verified professional/display/redistribution entitlement may be required before use. https://eodhd.com/financial-apis/terms-conditions
- SIX official End of Day History API: https://web.apiportal.six-group.com/portal/bfi/catalog/endOfDayHistory
- SIX Financial Information offers historical Time Series Daily and bulk interfaces: https://www.six-group.com/en/products-services/financial-information/download-center.html
- SIX trading corrections may arrive after final EOD files and require corrections processing: https://www.six-group.com/dam/download/market-data/statistics/historical-prices.pdf

## Decision
1. Treat EODHD as **read-only licensed-source evaluation**, not as an assumed production source.
2. For XSWX, prioritize SIX's own official historical feed and obtain precise redistribution/display and retention terms.
3. Require evidence of source access and contractual permission before production data use.
4. Keep market-specific pilot output independent of existing OHLCV store; preserve existing history.
5. For XLON, investigate official LSE data rights/source after XSWX, not endless retries on no-history sources.
6. On a paid source trial, compare a closed trading date and verify returned dates, ISIN/MIC/currency, adjustment policy and corrections.
7. Production success requires actual reduction in missingOpenClose count in a subsequent daily audit; scripts and mock tests alone are not a fix.

## Immediate external dependency
A verified account/license for one of these sources and proof of rights for public website display. Do not purchase subscriptions without owner authorization.
