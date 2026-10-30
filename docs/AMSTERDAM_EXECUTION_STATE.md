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
