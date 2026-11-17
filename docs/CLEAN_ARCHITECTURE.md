# Koersplein — clean architecture and deletion policy

## Single canonical browser routes
- `index.html`: homepage with `home-markets.js`.
- `market.html?market=<id>`: all venue lists with `generic-market.js` and `market-week-core.mjs`.
- `share.html`: instrument details with `share.js` and `chart.js`.
- Legacy country-specific HTML files remain redirects for existing inbound links; never create country-specific JavaScript renderers again.
- Amsterdam source-price candles are not verified adjusted returns; do not enable predictions based on them.

## Canonical data boundary
- `data/company-register-contracts.json` owns approved company selections, paths, counts and identity digests. `data/markets.json` supplies navigation and presentation metadata.
- `approved-daily-session.mjs` collects every company in each approved register; `archive-approved-session.mjs` is the development daily-history writer. The `history:update` CLI delegates to these same functions.
- `data/history/<actual MIC>:<official ISIN>.json` is the canonical daily history document. Older local/Cloudflare archives remain read-only compatibility sources; they have not been migrated or deleted.
- `daily-opportunity-ledger.mjs` is the universal prospective research entrypoint. `universal-market-machine1.mjs` is the shared historical diagnostic runner. Both use approved identities, the shared history reader and calendar horizons.
- Backfill tools, source discovery and evidence review are separate maintenance functions, not alternate daily collectors. Historical experiments and their results remain available; historical constituents, adjustment provenance and delistings must be verified before any performance promotion.

## Deletion gate
Run `npm run audit:architecture` and `npm test` before removing any page or script. An unreferenced root script is a *candidate*, not proof of dead code: dynamic loading, CLI jobs, scheduled workflows and tests may reference it. Delete only after searching every runtime, workflow and test dependency. Preserve rollback by committing changes on the development branch and validating staging before any production release.

## Known operational divergence
The consolidation branch contains one manually dispatchable daily workflow and one read-only regression workflow. Both target development; no deployment step is present. GitHub cron executes from the default branch, so this branch alone does not activate an unattended daily schedule. Default-branch workflows and existing external automations are outside this change. No production changes are authorized. Live Render branch/autodeploy configuration has not been verified because no Render workspace was selected.

## Block 1 acceptance
A repository-wide file inventory and dependency graph must be generated, candidates must be reviewed for runtime and workflow use, redundant files must be removed, all tests must pass, and staging must deploy successfully. The inventory alone is not completion. Preserve the original production deployment until a separately approved release.

Current implementation and measured limitations: `docs/CONSOLIDATION_2026-11-17.md`.
