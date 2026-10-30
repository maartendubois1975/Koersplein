# Koersplein — standing research and development agreement

## Owner-approved workflow (2026-10-30)

1. Perform substantive research, source comparisons, anomaly classification, and decision-making in the ChatGPT conversation, not by running recurring GitHub Actions as a research substitute.
2. GitHub may be read to retrieve existing source code, historical datasets, and audit outputs. Reading is not permission to make incremental edits.
3. Work in the largest practical coherent research block. Do not interrupt with micro-fixes, small commits, repeated CI triggers, or routine progress requests. Clearly separate verified evidence, leads, and unresolved issues.
4. Only after the research block is complete, prepare a consolidated implementation with explicit source provenance, tests, and rollback considerations. Do not fabricate historical prices, corporate-action factors, or missing OHLC values.
5. Make implementation changes only to the approved development branch `amsterdam-reset-20261027`; never modify `main` or publish to the public site without the owner's explicit approval.
6. Run a single comprehensive staging validation after the consolidated change where practical. A successful CI run does not itself validate economic returns, security lineage, data licensing, or point-in-time backtesting.
7. Maintain strict separation between raw chart data, adjusted prices, total-return series, and forecasting/backtests. Keep forecasts disabled until verified sources, corporate actions, delistings, historical constituents, and no-lookahead tests pass.
8. The assistant must proactively propose better approaches, challenge inefficient prior assumptions, and make technical decisions without making the owner invent the next steps.

This file is guidance for repository work. It does not technically enforce chat behavior; each assistant session must still follow it.

## Large-block delivery rule — 2026-10-30

When the owner says "Verder" or "Doe", continue the largest coherent development block feasible in the current session. Do not end work after one small fix, one commit, or a green CI run. Inspect dependencies, implement related changes, run staging tests, repair failures, and report only after a substantive result or a genuine external blocker. A partial result must be identified as partial.

At the start of each session read `docs/AMSTERDAM_EXECUTION_STATE.md`. At the end update its verified implementation status, tests, blockers and next coherent deliverable. Distinguish committed, tested and deployed work. No autonomous background execution is implied.

Only work on `amsterdam-reset-20261027`. Never publish to production without explicit approval. Never fabricate market data or bypass financial-data verification. Unverified forecasts remain blocked; safe fixture-based research development may proceed.
