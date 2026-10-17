# USA research checkpoint — 2026-10-17
Scope: draft PR #75 / feature/arena-usa-nyse-bootstrap-20261011 only. No production approval.

## Durable build block 1 state
- INCOMPLETE: NYSE, Nasdaq and TXSE official current common-equity listings, active trading, ISIN and share classes not fully proven. No source approval, historical backfill, research training, merge or publication.
- Existing NYSE/Nasdaq Nasdaq Trader imports remain non-ETF candidate registers, not verified common-stock lists. Current snapshot is not PIT historical membership.
- TXSE research parser uses official https://download.web.txse.com/public_symbols.txt and Nasdaq Trader https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt. TXSEListed=Y is listing-flag evidence; TXSEListed=N is tradable-only in this file, NOT proof against a separately announced dual listing.
- TXSE crosscheck only marks non-ETF/test, no-suffix, Exchange=F, common-description rows as COMMON_CANDIDATE_NOT_VERIFIED. All unknown, conflicting, preferred, debt, fund, test and ETF cases are excluded or quarantined. Every record retains null ISIN and unverified active-trading status.
- Official 2026-10-16 TXSE snapshot has TCBI, TCBI|PRB, DDS and DDT flagged Y; SCHW flagged N. Nasdaq Trader names TCBI/DDS common, TCBI$B preferred and DDT capital trust. No approved current common stock count claimed.
- This commit adds deterministic parser/regressions and a research-only artifact-producing workflow step; live CI and artifacts must be inspected before declaring the integration tested.
- Latest observed before this change: main 073ba288; PR #75 1616444b; successful US catalog run 38982251190 with NYSE/Nasdaq artifacts. No active GitHub Actions run in first-page inspection.
- The European probe scripts/audit/europe-daily-close-probe.mjs exists on main but not this USA branch; its direct Yahoo sample is not proof of US provider integration. Last complete US session 2026-10-16. Actual open/close canaries XNYS/XNAS/TXSE still pending.
- Source rights and official trading status remain unverified. Never use the history Alpaca workflow automatically without credentials/rights.

## Next independent tasks
Verify TXSE CI artifact and inspect quarantine. SEC/ISIN/effective-date crosswalk, current trading status and dual listings. Only after full catalog gate: reuse European OHLC route, prove actual dated open+close for each US exchange and broader canary. No backfill until source-first gate.
