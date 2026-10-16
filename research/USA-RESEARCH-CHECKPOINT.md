# USA research checkpoint — 2026-10-16

Scope: draft PR #75 / feature/arena-usa-nyse-bootstrap-20261011 only. NOT a production approval.

- Official Nasdaq Trader otherlisted.txt: Exchange=N means XNYS; nasdaqlisted.txt is separate for XNAS. The current directory contains ACT/CQS/Nasdaq symbol aliases and ETF/Test flags, but **no ISIN**. Store null ISIN until independently verified with effective-date provenance.
- ETF=N is NOT ordinary equity. Security-type labels are conservative hints only. SPAC units containing warrants or rights must remain UNIT, not WARRANT or RIGHT. No verified common stocks claimed.
- Preserve source creation timestamp and SHA-256; current snapshots omit delisted securities and cannot establish historical point-in-time constituents.
- Alpaca history script requests SIP daily raw OHLCV since 2016. Raw prices require separately validated split/dividend/corporate-action treatment, ticker-history/as-of identity, delistings and inactive stocks. Historical coverage since 2016 is not a full long-run historical universe.
- Official Alpaca FAQ allows historical SIP queries ending at least 15 minutes ago on Basic subject to credentials and entitlements. GitHub Actions run 38349911002 on 2026-10-13 failed ALPACA_CREDENTIALS_MISSING (both secrets empty). No retries without credentials.
- Market-data access is not redistribution permission. Confirm SIP/CTA/UTP/Alpaca terms and derived/public display rights before publishing any bars or charts.
- data/market-source-registry.json has no APPROVED XNYS/XNAS route. No US backfill, COMPLETE, training, model results or publication.
- Eleven research machines require PIT identity/membership, delisted and corporate-action coverage, purged walk-forward, independent OOS and untouched holdout. No training approval.

Next gates: validate GitHub Actions universe artifact; crosswalk official XNYS/XNAS MIC/ticker/ISIN/share class with effective dates; confirm history entitlement/rights; run difficult-symbol and delisted canaries; then separately prove PIT/OOS/holdout.

Sources:
- https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs
- https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt
- https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt
- https://docs.alpaca.markets/us/docs/market-data-faq

## 2026-10-16 — Offline OHLCV gate preparation

- Standalone fail-closed daily OHLCV validator and 23 deterministic offline regressions prepared; local Node tests passed. This is NOT an integrated historical importer or proof of any valid market bars.
- Safety checks blocked writing the replacement of `scripts/research/usa-nyse-history.mjs`. The existing importer therefore still uses its weaker checks; do not claim the new validator is active in ingestion.
- The American bootstrap workflow may run offline OHLCV tests, but green CI does not establish history access, point-in-time membership, delisted coverage, corporate-action adjustments, ISIN crosswalk or market-data redistribution rights.
- XNYS/XNAS remain RESEARCH_ONLY; no production merge, historical backfill, machine training or publication approved.

## 2026-10-17 — Official TXSE source distinction and CI stabilization (RESEARCH ONLY)

- Official Nasdaq Trader `otherlisted.txt` Exchange=F is a TXSE **primary listing** signal, not proof of current active trading, share class, ISIN, or the complete TXSE dual-listed universe.
- TXSE's official `/symbols` provides daily **tradable symbols**, not the issuer-listing universe; latest visible snapshot is 2026-10-16. The official `/all-listings` page currently says listings data is temporarily unavailable. Do not equate all NMS symbols tradable on TXSE with TXSE-listed common equity.
- TXSE's own Oct 2026 readiness alert identifies ET/SUN/SUNC/USAC as common partnership units (excluded), DDS as Class A common stock, and DDT as capital securities (excluded). No new TXSE symbol is APPROVED without independently dated active listing/trading, share-class and ISIN evidence.
- Official source URLs: https://www.txse.com/symbols ; https://www.txse.com/all-listings ; https://www.txse.com/alerts/fd5b0975-9e94-495c-8237-fbfe868484bc ; https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt
- Existing branch codebase audit had two `UNAPPROVED_WORKFLOW_PRESENT` errors for USA-only workflows (CI run 38970459253). The narrow USA workflow allowlist fix was prepared. Historical Alpaca workflow was changed to manual-only to avoid guaranteed missing-credentials failures on every USA branch push; this does not approve its market-data rights.
- Local fail-closed TXSE catalog prototype passed 17 synthetic offline assertions, but it has NOT been committed or proven on live exchange data. No live XNYS/XNAS/TXSE OHLC canary was proven in this run; the current European probe is available on main only, not this older USA branch.
- Block 1 INCOMPLETE: no full active listing/ISIN catalog, no approved USA history source, no backfill, training, merge or publication.
