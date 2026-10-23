# Koersplein Europe — programming and execution audit
Date: 2026-10-23
Mode: investigation only. No new importer, no production changes.

## Audited code
- .github/workflows/daily-open-close.yml: 8 matrix shards, 18:45 UTC weekdays; append-only Worker guard, OIDC, update, audit, artifact summary, issue #205. Separate Paris diagnostic/repair jobs are triggered by explicit request commits.
- scripts/cloudflare/daily-open-close-update.mjs: official catalog, source registry, factory catalog + public manifest, Paris history-only policy, missing-history rotation, existing history append, provider fallback, official daily verification.
- scripts/history/provider-registry.mjs: 7 registered providers: bse-sofia, zse-price-list, nasdaq-baltic, yahoo-chart, euronext-live, yahoo-isin-resolver, stockanalysis-bit. Candidate fallback order is global registration order, not market-specific source roles.
- scripts/history/official-daily-status.mjs: official status implemented for Sofia, Zagreb, Baltic and selected Euronext markets. No official XSWX/XLON no-trade status.
- scripts/cloudflare/reconcile-official-daily.mjs: runs after updater on all complete markets; checks official daily status; ignores Paris history-only exclusion, but skips missing storage keys; does not create new Paris histories.
- scripts/cloudflare/audit-daily-open-close.mjs: reads actual latest history partition and checks freshness; records official no-trades when supported. Recently added reason diagnostics; still requires run validation.
- scripts/cloudflare/summarize-europe-run.mjs: aggregates latest shard files and reports status INCOMPLETE if any missing or import failure. No verification of original historical completeness.
- scripts/cloudflare/client.mjs: Cloudflare factory API; OIDC auth and append-only writes, limited retries.
- scripts/cloudflare/storage-identity.mjs: D1 identity by MIC+ticker; legacy ID safeguards.
- scripts/cloudflare/europe-run-policy.mjs: freshness cutoff uses UTC weekday, not individual market calendars/holidays.

## Historical state from data/world-fill-plan.json and source registry
- XSWX Zurich COMPLETE 2026-09-27; one explicitly DATA_UNAVAILABLE. Historical source preflight in registry says 216/445 primary success, while discovery coverageRatio ~0.9955. This requires tracing exact preflight methodology before assuming contradiction or claiming missing history.
- XLON London COMPLETE 2026-10-05; 23 recorded DATA_UNAVAILABLE; provider preflight 1475/1498. Registry also notes official catalog download limitations. Do not undo completion based on daily audit alone.
- XPAR Paris COMPLETE but special follow policy existing-history-only; 717 retained history vs 53 untracked official listings (previously verified).
- XETR Frankfurt COMPLETE; 1416/1417 preflight primary coverage.

## Actual evidence, daily run 39861054608
7051 audited listings, 5815 current OHLC, 452 verified no trades, 784 missing OHLC, 491 failed import attempts. All 8 update shards failed strict audit.
XSWX: 239 daily missing, 233 failed imports, including 223 SOURCE_NO_HISTORY.
XLON: 247 daily missing, 79 failed imports.
XPAR: 4 daily missing.
These are DAILY freshness numbers; not evidence that historical bars were deleted.

## Root-cause hypotheses requiring proof
A. On XSWX/XLON no official no-trade detection, so a stale but intact history remains classified missing. Needs exchange trading calendar and authoritative session/trade evidence; cannot simply suppress.
B. Global provider fallback includes unrelated venues; may waste time and obscure real failures. Build market-appropriate fallback selection only after tests demonstrate provider compatibility and coverage.
C. UTC weekday cutoff does not account for market holidays, exchange-specific close or timezone; can create false stale alerts. Requires tested per-MIC session calendar.
D. Provider error categories are string-derived and aggregate all provider failures into one message; SOURCE_NO_HISTORY can reflect any 404, not necessarily a confirmed no-history instrument.
E. Audit uses latest partition and last element of bars; need prove bars are sorted and complete before treating that as latest trading date.
F. Missing-history rotation only 35 per shard per day, so newly cataloged instruments can be deferred intentionally; not necessarily a source failure.
G. Status INCOMPLETE if *any* provider attempt fails even if audit data eventually current; distinguish process reliability from market coverage.

## Test matrix before any production change
1. Historical preservation: compare stored partitions/manifest to original completion snapshots for XSWX/XLON, sampled and then full coverage.
2. Daily correctness: for each MIC, compare last stored trade date with official market sessions; verify NO_TRADES only with documented evidence.
3. Provider routing: test all 7 providers against their declared supported MICs and source roles, including negative tests for incompatible fallback.
4. Storage identity: MIC+ticker, duplicate ISIN, legacy ID, append-only and no accidental new catalog rows.
5. Paris: 717 retained and 53 excluded, 4 daily missing classified; ensure repair-only cannot accidentally re-add 53.
6. Pipeline: exercise update, audit, summary in isolated fixtures; inspect current workflow logs and artifacts.
7. Validate exact counts by MIC and failure class; no totals can be marked COMPLETE without actual evidence.

## Architecture decision
**Do not replace XSWX or XLON source routes just because daily freshness is incomplete.** Preserve existing completed historical pipelines. Resolve measured daily update failures by category. Paris is a separate limited-follow policy and its alternative route must only target genuine gaps among retained listings. Keep paid bulk pilots disabled until source access and redistribution rights are established.

## Operational blockers
Connector permits reading code and workflow logs but does not expose production Cloudflare D1/secret values or an arbitrary workflow dispatch operation. Existing issue #205 and workflow run 39861054608 provide evidence, but do not verify current production after the latest changes.
