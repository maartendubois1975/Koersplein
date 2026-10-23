# Europe recovery: evidence, diagnosis, execution gate
Date: 2026-10-23
Status: NOT RESOLVED — production daily run incomplete; read-only alternative source test prepared.

## Last confirmed production evidence
GitHub Actions run 39861054608, reporting for 2026-10-22:
- Catalog 7051
- Current OHLC 5815
- Verified no trades 452
- Missing OHLC 784
- Failed imports 491
- All 8 update shards failed the strict audit; summary failed.
- 5815 + 452 + 784 = 7051. Failed imports are a separate process count and must not be added to missing.
- Previous run 39725079803: missing 744, failed imports 730. Lower failures do not imply higher coverage.
- Logs of shard 1 (job 120111543302) show XSWX (Swiss exchange) 233 failed of 445 processed; 223 categorized SOURCE_NO_HISTORY, 4 PROVIDER_OTHER, 2 RATE_LIMIT, 4 AUTH_OR_ACCESS. This is a major structural source-coverage gap, not merely a transient timeout.

## Why not keep retrying the same providers
The failure categories show that some listings have no usable history from the existing source chain. Increasing retries or worker count cannot manufacture market data. For these, obtain a verified exchange-wide source, reconcile instrument identities, and audit trading dates and licensed use.

## Independent recovery lane
- Read-only bulk pilot: scripts/cloudflare/europe-exchange-bulk-pilot.mjs
- Manual workflow: .github/workflows/europe-bulk-coverage-pilot.yml
- Trading date is explicitly supplied. PA, XETRA and BR are probed independently.
- The workflow now invokes the actual daily OHLCV pilot, not merely a listings-count pilot.
- The pilot emits explicit SOURCE_ERROR per market and a nonzero exit if any source fails.
- Only Paris has a local official ISIN catalog in this pilot. Frankfurt and Brussels return source counts, not misleading match rates.
- ISIN reconciliation quarantines ambiguous provider code mappings, multiple codes per ISIN, duplicate catalog ISINs, and duplicate source bars.
- No production write or historical deletion.

## Blocking external dependencies
1. EODHD_API_TOKEN must be available as a GitHub Actions secret, or a different licensed bulk source must be configured. Access has not been verified.
2. Source terms must explicitly permit Koersplein's intended public display/redistribution. Technical API availability alone is insufficient.
3. A successful live pilot must show actual OHLCV coverage for a known closed trading date.
4. Paris needs reconciliation against the official 717 existing-history target, respecting MIC; raw ISIN-only joins are insufficient for ambiguous cross-MIC instruments.
5. Frankfurt, Brussels, Switzerland and other exchanges need their own verified official identity universes before match-rate claims.
6. A safe isolated append-only import dry run and rollback test are required before production cutover.

## Acceptance criteria
- Every market independently reports catalog count, eligible active listings, valid OHLCV, verified no-trades, missing, source failures, identity ambiguity, and timestamps.
- Counts reconcile without counting no-trade as a missing bar.
- Correct ISIN+MIC+currency and corporate-action conventions, no stale dates, no duplicate source records.
- Repeated runs are idempotent; existing history remains byte-for-byte intact.
- First switch only one market with rollback, and retain daily audits.

## Next operational action
Run the manual 'European bulk source coverage pilot' for a recent completed trading date after verifying EODHD_API_TOKEN and licensing. Do not claim Europe is fixed before real output is inspected. Prioritize XSWX source replacement because the logged SOURCE_NO_HISTORY concentration is high; EODHD PA/XETRA/BR pilot alone does not address XSWX.
