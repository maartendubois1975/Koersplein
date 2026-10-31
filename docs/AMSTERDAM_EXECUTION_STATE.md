# Amsterdam — execution handoff

Updated: 2026-10-30. This is a handoff, not a claim that the website is finished.

## Fixed owner instructions
- Work in the largest feasible coherent block; no one-fix-then-report pattern.
- Continue implementation, test, and repair before reporting.
- Staging branch only: `amsterdam-reset-20261027`; no production changes without approval.
- Never fabricate OHLC, corporate-action adjustments, historical constituents, or returns.
- Keep prediction publication blocked until provenance and point-in-time verification pass.
- Treat green CI as code validation, not as financial-data validation.

## Last verified evidence
- GitHub Actions run 41013085992 completed successfully on commit f8ff955d72320c9c7094960e0d3814a4af18b045.
- That run validated ingestion, browser integration, portfolio simulator and audits; research exam steps were skipped.
- This run does NOT cover subsequent commits, including changes to backfill-completeness evidence and the machine1 gate.
- Previously observed: 80 history instruments, about 361,114 daily bars; four lagging latest sessions (Almunda Pro, InPost, MotorK, Porceleyne Fles). Do not infer that a lag is a provider fault.
- Historical source and adjustment scope remain unverified; corporate actions, old constituents, delistings and issuer lineage require investigation.
- README contains older architecture/counts and should not be treated as a current verified status source.

## Next largest executable block
1. Inspect latest staging workflow and rerun complete tests on the latest staging head; repair any failures.
2. Build a date-scoped, evidence-based historical quality manifest per instrument (gaps, jumps, source, missing OHLC, adjustment status) without fabricating repairs.
3. Integrate the manifest with chart labeling and safe research-data selection; preserve separate source-price, adjusted and total-return semantics.
4. Build fixture-driven point-in-time forecasting tests for 3/6/12-month horizons and 10/20/30 percent targets, with purged chronological folds and no future leakage. Do not promote live predictions.
5. Validate Amsterdam market UI, daily opening/closing changes, charts and freshness against staging.
6. Update this file with commits, exact test run, actual blockers and next deliverable.

## Completion criteria
A block is complete only when implementation and relevant tests are verified, or an explicit external blocker prevents the remaining steps. Never call a commit or test trigger alone a complete delivery.

## Work performed in this session (pending fresh CI)
- Added date-scoped structural quality module and manifest builder: `scripts/research/amsterdam-period-quality.mjs`, `scripts/research/build-amsterdam-period-quality.mjs`.
- Added fixture tests for clean sessions, jumps, gaps, duplicates, missing high/low, invalid calendar dates.
- Integrated fixture/session tests and manifest generation into the Amsterdam staging workflow; quality manifest is uploaded with audit evidence.
- This is a diagnostic only: a clean structural observation does not prove an economically valid adjusted-return series.
- Latest changes have NOT yet been validated by a new complete workflow at the time of writing. Check latest run before marking tested.
- Next: examine CI, repair errors, then integrate conservative period warnings into the Amsterdam chart UI and build point-in-time fixture research tests.

## Session continuation — 2026-10-30
- Verified workflow run 41013786049: job succeeded; prediction exams and publication steps were skipped. This does not establish trustworthy financial returns.
- Reviewed workflow: no daily cron schedule; refresh is manually dispatched or triggered by a designated staging path. Automated daily collection is NOT operationally verified.
- Chart disclosure committed in de3f988268f1fd0fc9a690929eb0fa4951c4f8cf (share.js): Amsterdam historical charts now warn that unadjusted/uncorroborated prices are not validated returns. Optional period-specific anomaly counts depend on a published quality manifest; when absent, a conservative warning remains.
- IMPORTANT: the quality manifest currently writes to research/output, not a deployed data path. Do not claim period anomaly counts work in staging until a safe, versioned publication path is designed and tested.
- This change has not yet been independently validated in a fresh CI run. No production deployment.
- Next coherent delivery: version and safely expose diagnostic manifest for staging, add chart tests, establish a safe non-publishing scheduled ingestion plan, and validate together in one comprehensive staging run.

## Consolidated continuation — 2026-10-31
- Researched chart rendering, normalization, and the existing staging test workflow together before changing code.
- Commit 893ee400600f481bfca917f75874934d1482871f computes structural diagnostics from the exact Amsterdam chart bars rather than fetching an unavailable research/output HTTP artifact.
- Commit 0291a20904e99bfa2b5623ce9dabf38576ae3713 fixes null/undefined/empty values being coerced to zero in chart.js; missing high/low/adjusted close/volume remain missing.
- Commit a21cbea864af59627016c0b228b42a7c97c0dda2 adds fixture tests for chart-normalized missing fields and date-scoped structural diagnostics.
- Commit abdcf0dbae39e22a762b231972579157295b2506 includes share.js and chart.js syntax checks in staging CI.
- Commit 2b7aa082ba1670e4a9f41d24358e3b1c89f34a37 updates the staging-only trigger path for one comprehensive dry run. Workflow result NOT YET VERIFIED; do not claim tests passed.
- No production publication or automatic daily scheduling has been implemented. Historical source lineage, five unmapped instruments, and return adjustment evidence remain open. Forecast publication remains blocked.
- Next block: inspect triggered run results, repair failures, then investigate provider mappings and staging-only daily scheduling with explicit source freshness checks.

## Cross-market reconciliation — 2026-10-31
- Inspected all five entries previously labeled unresolved in data/amsterdam-import-status.json against the canonical catalog: AF and ENX and SGO are XPAR-primary; FAGR and ONWD are XBRU-primary. Each has displayPolicy cross-market-reference-only.
- Commit ad40d10f96c21f67b04803474452c31ff8f06c70 separates five intentional cross-market references from zero missing Amsterdam target mappings; this does NOT verify that corresponding Paris/Brussels histories exist or are licensed for public display.
- Active XAMS targets remain 80. Do not invent duplicate Amsterdam histories or report the five as repaired provider imports.
- Workflow test triggered in previous block, but its current run ID/outcome has not been retrieved through available connector actions; do not assert a green test.
- Next consolidated work: verify staging workflow outcome using GitHub Actions, test chart integration on deployed staging branch, investigate four lagging XAMS sessions and independently validate cross-market primary venue histories. No production changes.
