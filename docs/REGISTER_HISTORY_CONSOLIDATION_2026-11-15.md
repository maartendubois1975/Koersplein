# Company registers, provider routing and historical processing — 15 November 2026

Development branch: `amsterdam-reset-20261027`. Starting commit: `dcc59552cedab0857d12cd988f10a082483ac88a`. Production and remote databases are outside this change. No data refresh or deployment was executed.

## Scope and acceptance

Inspect catalog -> identity/mappings -> provider selection -> validation -> storage -> status -> public chart tests, plus the active development workflow. Preserve exact approved company identities and every archived history file. Use one source register for importer routes; reject unapproved providers. Status must not migrate or seed a database. Keep source observations separate from import permission. Acceptance is exact 80/105 registers, unchanged history hashes, successful offline regression, and complete read-only Brussels source observations. Rollback is a revert of this one consolidated commit; there are no database migrations or destructive data changes to reverse.

## Register decision

The branch still contained the old 133-row Brussels directory. The owner-approved `Koersplein_Brussel_105_staging.json` was read in full and adopted exactly: 94 regulated, 6 Growth, 5 Access. The original 133-row research remains in `research/brussels-company-only-full-triage-2026-11-13.json`; this change does not rerun or supersede the issuer research. No historical files for excluded listings are removed.

`data/company-register-contracts.json` fixes counts and a SHA-256 of the sorted ISIN/ticker/primary-MIC identities. `company-register.mjs` is shared by the validator, JSON-history catalog loader, SQLite seeding and Worker catalog preparation. Changes to membership require an explicit reviewed contract update, rather than automatic directory replacement. Names and evidence remain in each canonical catalog.

Delete the unsafe Amsterdam CSV-to-canonical-catalog importer and the equivalent Brussels directory updater. Remove their package/documentation entry points. The generic source audit now preserves the approved Amsterdam/Brussels source register; research observations cannot rewrite those approvals. Preserve research files, migrations, cross-branch production OIDC allowlists and recoverable historical provenance. A production workflow name in OIDC policy is an intentional external trust boundary, not permission to recreate that workflow here.

## Shared processing

- `source-policy.mjs` derives primary and allowed fallback routes from `market-source-registry.json`. Local JSON imports, SQLite jobs, Worker jobs, European daily imports, focused Paris recovery, universal market ingestion and source-evidence collection reuse that policy. Segment MICs resolve to the correct parent approval while providers retain the actual listing MIC.
- The pre-existing Amsterdam daily official-first/newest-approved-secondary rule is configured centrally as `dailySources` and `compareDailyLatest`. Registration order no longer grants authorization to an ingestion route. Paid/public candidates and independent-validation roles cannot silently become fallbacks.
- `ProviderRegistry.fetchDaily` now has one response-acceptance path for timed and untimed requests, preserving cancellation, empty-response evidence inspection, asynchronous validation and provider isolation. Fallback failures remain in response provenance.
- Pure bar validation, merge, mover calculation and verified-backfill logic live in `bars.mjs`; `engine.mjs` re-exports the old API for compatibility. Generic tests and session readiness have no hardcoded Amsterdam count/scope. Amsterdam callers explicitly supply their validated universe size. Amsterdam-specific identity and UI gates remain specific.
- Refreshes refuse to rewrite an archive containing rejected rows. Existing adjusted-close preservation and invalid-update protection remain. Worker job partition writes are append-only for all venues; no hardcoded `.AS` ticker is constructed for another exchange.
- Database status uses SQLite read-only/query-only mode, without migrations, directory creation or catalog seeding. The historical validation helper returns observations without changing `history_status`. Explicit jobs still record their own progress/errors. Bar storage refreshes its aggregate status once inside its transaction.
- Obsolete tests against absent production workflow files now check the actual development regression workflow and read-only probe boundary. Closed-session cutoffs, source provenance, ISIN collisions and no-write guards remain tested. No production workflow was restored.

## Brussels source research

Read-only recent window: 16 October–15 November 2026, all 105 companies, Yahoo and the public Euronext endpoint. Nothing from the probe was imported into history or a database.

| Observation | Initial pass | Detailed comparison pass |
|---|---:|---:|
| Yahoo with usable positive-volume OHLC | 103 | 103 |
| Public Euronext with usable positive-volume OHLC | 95 | 89 |
| Combined companies with recent observed bars | 103 | 103 |

Provider responses vary. HTTP errors/empty windows are source observations, not proof of no trading or delisting. In the detailed pass, 89 companies had overlapping dates: 1,728 compared sessions, 1,721 agreeing OHLC sessions and 7 differing sessions. Differences occur for KBC, COMB, OBEL, CMBT, TITC, WDP and ARGX; dates/fields are in `research/output/xbru-source-summary.json`. The tolerance is max(0.000001 absolute, 0.000001 relative). This is a short recent-window comparison, not a full-history or corporate-action certification.

The two recent-window absences were Neufcour (`MLNEU`, BE0003680916) and FLOWSPARKS (`FLSP`, BE0003847648), both Access/MLXB. A separate one-year read-only request found 25 and 51 traded rows respectively in both sources, ending 16 September and 15 October 2026. Their listing identities remain in the register; absence after those dates is unresolved, not an invented NO_TRADES declaration.

The public Euronext route stays `CANDIDATE_PUBLIC` for Brussels: coverage variation and the seven disagreements prevent automatic fallback approval. The existing Yahoo route stays primary. Both adapters now recognize ALXB and MLXB without changing storage identities or promoting any ticker.

Official Euronext Web Services is a separate potential API source for historical data, documented at https://www.euronext.com/en/data/how-access-market-data/web-services and https://connect2.euronext.com/sites/default/files/documentation/data/ews_api_-_historical_data_client_specification.pdf . Provisioned endpoint/key and a suitable data agreement are required; no account or subscription was created. Its coverage for the exact 105 listings remains untested.

EODHD documents exchange/ticker enumeration, optional ISINs and historical access at https://eodhd.com/financial-apis/exchanges-api-list-of-tickers-and-trading-hours . It requires a token. Exact Brussels/segment identities, adjustment semantics, all-105 coverage and display rights were not verified, so it remains a paid candidate with no active adapter. Do not infer complete coverage from the vendor's general documentation.

Evidence: `xbru-source-observations.json`, `xbru-source-summary.json` and `xbru-missing-recent-source-check.json` under `research/output/`.

## Verification and limits

All 78 final local verification commands passed. Final local test evidence is recorded in `research/output/consolidation-regression-summary.json`. It covers `npm test`, generic/history integration, all 40 individual Cloudflare regression modules, the Paris research suite, identity verification, Amsterdam end-to-end acceptance, syntax of changed executable modules, and byte hashes of all 81 files under `data/history/`.

The Amsterdam acceptance reads 80 histories / 363,590 bars, with zero structural issues. Four instruments lag the latest observed session; the existing fixed October public fixture has 11 unresolved missing sessions. This block neither fills those gaps nor claims their cause.

Local regression is not GitHub Actions validation or a deployment. Production remains unchanged. Render account inspection was unavailable without a selected workspace; no workspace was selected and no Render operation was performed. No statement about deployed GitHub–Render alignment is made. Forecast publication remains blocked by existing provenance/corporate-action/point-in-time requirements.
