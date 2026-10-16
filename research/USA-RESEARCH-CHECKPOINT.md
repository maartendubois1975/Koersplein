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
