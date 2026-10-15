# Koersplein Europe — Block 1: architecture decision and rebuild baseline

Status: DESIGN BASELINE; NOT ACCEPTED AS COMPLETE. Branch: fix/arena-history-quality-gate-20261010. No production writes.

## Observed architecture
- Six workflows on main: codebase-audit, complete-market-analysis, daily-open-close, daily-opportunity-ledger, machine-arena-europe, universal-source-first. Repair branch also contains machine-arena-repair-validation.
- Existing source adapters: scripts/cloudflare/universal-source-catalog.mjs, universal-source-audit.mjs, scripts/history/provider-registry.mjs and six providers.
- Canonical intended state: data/world-fill-plan.json + data/market-source-registry.json, reduced by scripts/cloudflare/reduce-europe-completions.mjs. These are currently separate state files and their agreement is not proof of actual coverage.
- Research path: scripts/research/complete-market-gate.mjs -> universal-market-machine1.mjs -> europe-historical-quality-core.mjs -> optional opportunity-map/relative/judge -> pipeline-summary.json -> europe-31-market-audit.mjs.
- M01–M11 contract: research/machine-arena-europe-v1.json. The pipeline does not execute all eleven independently; its results object and descriptive machine names must not count as execution evidence.

## Verified architectural defects / contradictions
1. COMPLETE is read as a prerequisite by complete-market-gate.mjs, europe-history-preflight.mjs and europe-machine-arena-readiness.mjs, while the same status has historically been assigned by market-handoff-signal.mjs using freshness/count checks. This is a circular readiness assertion, not an independent proof of official equity universe and historical integrity.
2. block1-data-readiness.mjs flags missing instrument types but does not independently verify official source; block1-instrument-quarantine.mjs blocks instruments without explicit type provenance. The latest known run quarantined 7110 instruments, 546 missing ISIN, 27 invalid ISIN, 7110 missing type evidence.
3. universal-market-runner.mjs reuses stored identity by MIC+ticker, may manufacture MIC-TICKER identifiers, and silently deduplicates ISIN/listings; universal-source-first.yml Worker preflight also reuses stored ISIN by ticker. Identity is not guaranteed stable across ticker reuse.
4. europe-history-preflight.mjs checks at least 260 valid-close rows; it explicitly does not validate OHLCV integrity, corporate actions, rights, PIT, OOS or holdout. market-history-source.mjs can return provisional Yahoo fallback histories. The historical-quality core checks per-instrument row counts and provenance labels, not independent bar correctness.
5. The central Europe Arena workflow and repair workflow are overlapping diagnostics; complete-market-analysis.yml separately runs the same pipeline and writes data/top5-three-month.json to main after success. One canonical promotion authority is not yet implemented.
6. Daily open/close workflow runs on main with a 180-minute timeout and cancel-in-progress true. No independent proof that all 31 exchanges update on schedule.
7. europe-31-market-audit.mjs checks baseline summaries but explicitly emits elevenMachineCompetitionValidated:false and productionReady:false; baseline readiness must never be called machine validation.

## Decisions: retain / refactor / retire only after proof
RETAIN: official market adapters where live downloads and classifications are verified; six existing provider adapters where source terms/coverage pass; PIT, research and machine modules as reusable implementations; existing data and reports as untrusted inputs pending revalidation.
REFACTOR: catalog schema into immutable official listing identities (MIC, ticker, ISIN, listing validity interval, type, evidence URL, snapshot timestamp, fingerprint); distinct identity/catalog/history/PIT/experiment gates; a single market result schema and single canonical promotion writer; stable market-local errors and cross-market aggregation.
REPLACE: ticker-only identity reuse and synthetic identifiers as proof of official ISIN; aggregate-count-only completion; implicit COMPLETE-to-research admission; success inferred from file existence or declared machine names.
RETIRE AFTER REPLACEMENT PASSES: duplicate orchestration/promotion routes, old status writers and unnecessary retries. Do not disable existing production paths before parity and rollback tests.

## Canonical target pipeline
Official snapshot -> classification and ISIN/listing verification -> immutable catalog fingerprint -> provider rights + canary -> per-instrument OHLCV and actions -> historical membership/PIT gate -> machine-specific immutable predictions -> independent walk-forward/OOS/holdout judge -> audited market evidence -> single promotion writer -> website/daily updates.
A blocked instrument has explicit evidence and reason; a blocked market never stops independent markets. Data unavailable is not a pass for research coverage.

## Required acceptance tests before Block 1 is marked DONE
- Inventory all active workflow entry points, triggers, concurrency groups, checkout refs, state writers and publication writes; map which are production-active and which are branch-only.
- Reproduce the catalog/type/identity failure from a pinned input snapshot; add a regression test that forbids silent dropped/duplicated listings and ticker-only ISIN substitution.
- Add contract tests proving that COMPLETE cannot arise from freshness/count alone; that missing source/ISIN/type/rights/adjustments/PIT cannot pass; and that all eleven machines need execution and OOS evidence.
- Establish one read-only baseline report of 31 markets with verified/unverified/blocked counts and one machine-by-machine execution map.
- Run tests on the actual repair branch, attach logs/artifacts, record pass/fail; no merge or deployment before the acceptance evidence exists.

## Build sequence
B1 architecture, ownership, acceptance harness; B2 official 31 market catalogs; B3 history and corporate actions; B4 canonical market factory; B5 eleven independent machine contracts; B6 blinded PIT walk-forward/OOS/holdout; B7 independent QA and ranking; B8 publication and daily operations.

This document is an architecture and evidence inventory, not a claim that B1 tests have passed.

## Deep audit addendum — machine-by-machine execution evidence (2026-10-15)
Reviewed actual test-block2/3/4/5/6 scripts, universal-market-machine1, independent-market-judge, model-arena, universal-opportunity-map, and repair workflow job 116244550652.

| Machine | Intended role | Observed executable evidence | Assessment |
|---|---|---|---|
| M01 | Historical blind time machine | universal-market-machine1 runs monthly price-momentum baseline and writes predictions AND realized labels in one results file | Baseline implementation; no independently precommitted prediction ledger demonstrated in market run |
| M02 | Hindsight researcher | Opportunity-map is executed after coverage gate, but is not proven to be the contract's isolated hindsight researcher | Not verified |
| M03 | Independent judge | independent-market-judge writes NOT_VALIDATED and says only M01 baseline exists | Explicitly not validated |
| M04 | Sector/type specialist | classificationFor attached to M01 features, with synthetic core tests | Not independently evaluated |
| M05 | Market regime | Declared missing in M01 missingSignals; separate modules exist | No proven market execution |
| M06 | Relative winner | universal-relative-specialist runs after coverage gate | No proven independent OOS |
| M07 | Price/volume pattern | Features computed within M01 | No standalone competition evidence |
| M08 | Fundamental specialist | Explicitly missing PIT fundamentals in M01 | No proven execution |
| M09 | Anomaly | Features computed within M01 | No standalone competition evidence |
| M10 | Loser guard | Risk guard computed within M01 | No standalone competition evidence |
| M11 | Horizon ensemble | Synthetic test of ensembleByHorizon, but not called in complete-market-pipeline | No live validated ensemble evidence |

Synthetic test limitations: test-block2 uses 260 generated bars; test-block4 uses artificial 2000–2025 monthly rows; test-block5 uses synthetic trials with predeclared oos/holdoutPassed. These establish unit behavior, not actual model validation. test-block6 verifies snapshot status transitions on hand-authored rankings, not production feeds.

Reproducible run evidence: GitHub Actions run 38680765045, readiness job 116244550652, quarantine output: 7110 instruments; 0 verified ordinary shares; 7110 quarantined; 546 missing ISIN; 27 invalid ISIN; 7110 without classification provenance. This is an observed blocker and must not be bypassed.

Critical test acceptance: distinguish UNIT_PASS, DATA_PASS, HISTORICAL_PASS, PIT_PASS, OOS_PASS, HOLDOUT_PASS and PRODUCTION_PASS. No transition may be inferred from a different category. Machine statuses remain NOT_PROVEN until their own real-data evidence exists.

Additional source gap: model-arena.mjs outputs status CONFIGURED and five declared models, not fitted model artifacts or OOS competition. complete-market-analysis.yml can publish top5-three-month.json to main, while canonical European validation remains unproven; production promotion must be gated by independent validation before replacing this route.
