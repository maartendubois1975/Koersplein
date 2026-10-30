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
