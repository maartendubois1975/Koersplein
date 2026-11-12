# Amsterdam — architecture decision and integrated completion gate (2026-11-12)

Status: **research and design recorded; implementation NOT approved as complete**.
Scope: approved staging branch `amsterdam-reset-20261027`; no production change.

## Evidence reviewed

- `AGENTS.md`, `docs/AMSTERDAM_EXECUTION_STATE.md`, `.gitignore`.
- `data/euronext-amsterdam.json`, `data/history-instruments.json`, `data/amsterdam-history-manifest.json`.
- `scripts/history/audit-amsterdam-import.mjs`, `scripts/history/test-amsterdam-public-integration.mjs`, `scripts/history/amsterdam-end-to-end-acceptance.mjs`.
- `.github/workflows/amsterdam-daily-history.yml`, `.github/workflows/xams-regression-check.yml`, and isolated Bever PR #215 migration workflow.
- Actual Actions run 43158501619 (migration failed at `git add` because `data/history/` is ignored); run 43158510780 (read-only PR regression fails because BEVER history is not yet committed).

## Verified dependency failures

1. The active universe is represented independently in catalog, provider mappings, and public manifest; updating two without the third causes 79/80 browser identity coverage.
2. `.gitignore` excludes `data/history/`; the migration workflow tries `git add data/history/NL0000285278.json` without a deliberate tracked-file exception, so the final commit fails despite successful checks.
3. The read-only PR regression runs against a branch where the provider-generated BEVER file is not yet committed. It cannot pass its 80-history gate until an atomic validated history commit is available.
4. The fixed reference-week test must distinguish genuine lack of observed transactions from a missing history document; no candles or NO_TRADES declarations may be synthesized.
5. In run 43158501619, the migration's post-fetch checks reported catalog=80, mapped=80, imported=80, records=363362, invalid=0; end-to-end structuralPass=true, issues=0. These are **temporary runner observations**, not committed staging evidence or proof of licensed/adjusted financial returns.
6. The existing staging head still has InPost and lacks committed BEVER history; it must not be declared complete.

## Target architecture

- One reviewed, canonical active-universe definition, with deterministic generation of provider mappings and public manifest or deterministic drift detection if generated artifacts remain committed.
- Strict identity checks (ISIN, symbol, MIC, currency, unique identities) before ingestion, after ingestion, and in public API/browser integration.
- Historical OHLC stored only from a verifiable source. No generated or backfilled synthetic prices, no invented zero-trade days.
- An explicit archival policy for delisted instruments: remove from the **active** universe without silently destroying evidence needed for historical point-in-time reconstruction.
- One isolated migration transaction: verify identities and provider bars, generate dependent artifacts, run all required tests, then commit the complete coherent dataset/configuration change. The regression gate must evaluate that committed candidate, not an incomplete pre-migration snapshot.
- Preserve safe staging deployment, rollback SHA, and explicit owner approval for production.

## One integrated implementation block — acceptance before edits

1. Inventory all consumers and writers of catalog, mapping, manifest and history paths; decide the canonical authority and generated-artifact contract. Include chart/UI and API contract.
2. Design a single migration script or existing workflow extension that validates the BEVER file and deliberately stages only approved history artifacts (with explicit `git add -f` **only** for the exact validated file, or a narrower ignore exception). No blanket unignore of `data/history/`.
3. Preserve delisted InPost historical evidence in an explicitly defined archive where required; do not treat a delisting as permission to erase historical facts.
4. Generate or verify manifest and mappings from the reviewed universe. Make PR regression run on a complete, committed candidate. Add fixtures for thinly traded instruments, missing provider bars, identity drift, malformed JSON, and untracked/ignored history.
5. Run syntax, `npm test`, `npm run history:test`, full Amsterdam end-to-end acceptance, source/provenance audits, session readiness, and public-page contract tests **together**. Confirm no failure, including git staging/commit and post-commit verification.
6. Only then merge to approved staging branch, deploy **staging only**, inspect deployed identity and history API, verify 80/80 plus dates and chart views. Production requires separate approval.

## Rollback and stop conditions

- Before any merge/deploy record the current staging branch SHA and live Render staging deploy SHA.
- Any missing real bar, unresolved identity mismatch, regression failure, commit failure, unexpected provider condition or data-provenance misrepresentation blocks merge/deploy.
- Preserve the previous staging deployment as rollback target. Forecast publication remains blocked until separate point-in-time and adjustment verification.
- Do not claim 'finished' based on a green structural test alone.

## Reporting contract

Use explicit statuses: researched, planned, committed, CI verified, staging deployed, live verified. This document is **researched/planned**, not implemented or deployed.
