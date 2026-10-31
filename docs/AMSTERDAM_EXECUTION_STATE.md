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

## 2026-10-31 chart correctness continuation
- Investigated share.js and chart.js directly: the latest close-to-close percentage could be presented even when the last observation had an unverified >50% discontinuity or >30-day gap. Commit 45017cb9472b653e5191cb38e5054e1657c14e1c suppresses that percentage and displays the reason. This is a conservative structural gate, not corporate-action verification.
- Found UTC setMonth overflow at month ends. Commit afadf940ada20602bf9dfa288b1c3235a0c0cf6c adds calendar-clamped periodStartDate; commit 7a649fb034e46ea66ea35611a833caadfa641210 shares this boundary between chart and warning counts.
- Commit 26e2ed0c1023fc47d4e2aaec4fcc24ed56d9ecd0 adds month-end, leap-year and discontinuity fixture assertions.
- All commits staging only. New fixtures not yet confirmed green in GitHub Actions; no deployment, no claim of complete Amsterdam.
- Cross-market status: 80 XAMS histories and five references to XPAR/XBRU. Source lineage and actual cross-market history availability not independently verified.

## 2026-10-31 staging safety
- Inspected full Amsterdam workflow and discovered that its job predicate also permitted manual dispatch on main. Commit 5b2333ba080ea0b6964461d1ab61a7249d1c1e9e restricts the entire job and both publication steps to the approved staging branch.
- This change is committed, not independently CI-validated. No public deployment or schedule was created. Scheduling a staging-only workflow requires care because GitHub cron runs on the default branch.
- Latest chart fixes remain unverified by an observed workflow result. The next block must retrieve an actual run outcome and fix failures before claiming readiness.

## 2026-10-31 latest close return testability
- Commit 21ca3619faa238a5358e92a789f89fc52828ca54 extracts a pure latestCloseChange gate from the structural diagnostics. Returns no percentage for missing bars, invalid closes, suspicious jump/gap, missing OHLC, or duplicate latest dates. This is not a verified adjusted-return calculation.
- Commit b7a3977fc071a655c349fd7933fe16132ff59353 integrates the shared gate on the XAMS share page; other venues keep their existing logic.
- Commits f543d814a5ce47922a8cb9b5040e333b39a78c8b and d95917a9c8cfaa955fd9a37da80fccd7fd80c29d add normal, jump, gap, incomplete, insufficient-history fixtures and floating-point-safe assertion.
- Unable to run local repository tests: local runtime cannot resolve github.com. GitHub connector commit status and PR-workflow lookup for earlier staging trigger returned no runs; neither proves the push workflow failed nor passed. CI must be checked directly in Actions.
- All work is staging-only; production untouched. Next: inspect actual Actions run outcome and deployment branch, then resolve daily source freshness and schedule without allowing main publication.

## 2026-10-31 ingestion integrity continuation
- Direct code inspection found validateBars in scripts/history/engine.mjs accepted calendar-impossible dates matching YYYY-MM-DD and allowed negative/nonfinite high-low values to pass some checks. Commit 8c698ad4d45677be97d03793a861429aeaba0a2b rejects invalid dates and malformed high-low fields before storing or merging new bars.
- Commit 3df8204d98e65eb35fdecce1f932e8d59f09c437 adds invalid-date and OHLC fixtures to the Amsterdam session suite.
- Commit 07fc5c7b3ae0a401309ca9b04f696301d6b16b3e applies the same strict date validation to chart.js history normalization.
- No verified CI result yet; changes committed only to approved staging branch. No production deployment, no scheduled import. Existing historical data must still be audited independently; these checks prevent future malformed inputs but do not retroactively certify source prices.
