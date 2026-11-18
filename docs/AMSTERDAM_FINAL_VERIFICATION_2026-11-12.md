# Amsterdam final verification — 2026-11-12

## Verified and deployed (staging only)
- Integrated PR #216 into `amsterdam-reset-20261027` at `32f0dd9b9c7de2d46ce3bac56c26951491537f67`.
- Isolated combined regression run 43159399123: success.
- Render deployment `dep-dbqkka56e07s73fggksg`: live on the staging service; build executes `npm test && npm run history:test && node scripts/history/amsterdam-end-to-end-acceptance.mjs`.
- Render build output: catalog=80, mapped=80, imported=80, historyRows=363439, invalid=0, structural issues=0, observedDate=2026-11-11, lagging=3.
- The published build is not evidence of correct visual browser rendering, data redistribution rights, corporate-action adjusted returns, or official close prices.

## Actual unresolved market-data observations
- Reference week 2026-10-19 through 2026-10-23: 389/400 observed share/day candles. 11 absent candles: BEVER five; AMUND two; MTRK two; PORF two.
- BEVER last observed candle 2026-11-04 in the checked committed audit; PORF 2026-11-09. Those dates are not evidence that later exchange sessions had trades.
- AMUND and MTRK have later observed candles but historical gaps in the reference week.
- `sessionReadiness` compares dates to the newest provider observation, and its `laggingCount` does **not** distinguish no-trade days, suspension, stale provider, and ingestion failure. Do not automatically backfill with prior closes.
- Audit committed before the Render build is older than the generated build evidence; prefer the exact run/deploy artifact when reporting counts.

## Closure criteria still open
1. Obtain independent exchange/session evidence for each missing day, classify as confirmed no-trade, suspension, provider omission, or unresolved; do not invent OHLC.
2. Perform an actual browser check on the deployed Amsterdam list, share pages and 1/3/6/12-month charts, including network failures and console errors. The available external browser fetch could not access the staging URL; automated tests are not a substitute.
3. Verify daily scheduler execution, provider provenance and rights; separately verify official close semantics and adjustments before claiming return accuracy.
4. Keep forecasting publication disabled until point-in-time and historical-adjustment verification passes.

## Scope and rollback
- Production/main unchanged by this verification.
- Staging deployed SHA: `32f0dd9b9c7de2d46ce3bac56c26951491537f67`.
- Prior known staging deployment commit: `b16b446429e96d3ed3664faa7e76ee4bab22f787`; rollback requires an explicit deliberate staging deployment, not a silent data rewrite.
