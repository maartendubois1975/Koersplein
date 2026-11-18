# Koersplein — clean architecture and deletion policy

## Single canonical browser routes
- `index.html`: homepage with `home-markets.js`.
- `market.html?market=<id>`: all venue lists with `generic-market.js` and `market-week-core.mjs`.
- `share.html`: instrument details with `share.js` and `chart.js`.
- Legacy country-specific HTML files remain redirects for existing inbound links; never create country-specific JavaScript renderers again.
- Amsterdam source-price candles are not verified adjusted returns; do not enable predictions based on them.

## Canonical data boundary
- `data/markets.json` owns venue IDs and dataset paths.
- `data/history/` owns committed historical records; preserve identity, audit evidence and provenance.
- `scripts/history/` owns ingestion and integrity validation; do not create a second importer without explicitly retiring the first.
- `scripts/research/` is research-only; no research diagnostics should silently mutate production prices.

## Deletion gate
Run `npm run audit:architecture` and `npm test` before removing any page or script. An unreferenced root script is a *candidate*, not proof of dead code: dynamic loading, CLI jobs, scheduled workflows and tests may reference it. Delete only after searching every runtime, workflow and test dependency. Preserve rollback by committing changes on the development branch and validating staging before any production release.

## Known operational divergence
GitHub scheduled workflows execute from the default branch, not solely from the development branch. Main has separate scheduled Amsterdam candidate and staging collectors; the development branch also declares an Amsterdam schedule that does not by itself activate on GitHub. Consolidation of these schedules requires verifying the current main workflow and its job safety. Do not assert that one daily pipeline is operational until verified.

## Block 1 acceptance
A repository-wide file inventory and dependency graph must be generated, candidates must be reviewed for runtime and workflow use, redundant files must be removed, all tests must pass, and staging must deploy successfully. The inventory alone is not completion. Preserve the original production deployment until a separately approved release.
