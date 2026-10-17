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

## 2026-10-17 06:00 Europe/Amsterdam — NYSE history fail-closed integration
- Target branch only; NYSE historical import now filters verified ordinary active shares before any provider request, emits eligibility/quarantine reasons, and requires an explicit SIP rights flag before Alpaca credentials are used.
- Daily bars must pass existing strict date/OHLCV/volume validation before writing; synthetic regression cases cover funds, unverified shares, licensing, credentials, zero open, duplicate dates. Test fixtures are NOT actual market prices or evidence of source rights.
- Existing official NYSE/Nasdaq/TXSE candidate registers are NOT verified common-share catalogs; zero US markets COMPLETE. No backfill, merge, Europe/main write or production publication authorized.
- Verify resulting CI run and artifacts independently. NYSE historical workflow remains blocked until independent official listing/issuer/share-class/ISIN/active-trading proofs and data rights are approved; do not treat successful catalog CI as a source gate.

## 2026-10-17 06:35 Europe/Amsterdam — ISIN check-digit fail-closed fix
- Reproduced: previous NYSE history eligibility checked only ISIN syntax and accepted `US00846U1017` despite its invalid ISO 6166 check digit. Existing synthetic fixture `US0000000000` also had an invalid check digit.
- Added ISO 6166 alphanumeric expansion plus Luhn verification to the existing NYSE eligibility gate; invalid or malformed ISINs are quarantined as ISIN_NOT_VERIFIED before any provider call.
- Updated the synthetic positive fixture to checksum-valid `US0000000002` (test-only; not a real issuer identity claim). Added regression for valid US/GB ISINs, invalid checksum, bad format, and runner refusal to request prices for an invalid ISIN.
- Earlier CI run 39001144208 at commit abfffd1e was green and produced NYSE/Nasdaq/TXSE artifacts; it did not cover this checksum bug. Verify the new commit's CI separately. No live US OHLC canary, catalog approval, backfill, merge or production changes.

## 2026-10-17 07:00 Europe/Amsterdam — independent US dated open/close research probe
- Added a research-only Yahoo chart daily-bar probe modeled on the European date/open/close approach, but with explicit US provider tickers, New York session dates, provider exchange/currency/instrument identity checks and OHLCV validation.
- Samples large/small/recent/share-class tickers for XNYS and XNAS, and TXSE-listed-flag candidates separately. TXSE Yahoo bars must prove the TXSE provider market itself; an XNAS bar for a dual-listed symbol is rejected.
- Official current candidate snapshot is required before requesting each ticker. Catalog SEC/issuer/share-class/ISIN and active-trading proof remains incomplete; Yahoo rights and adjustment policy remain NOT APPROVED.
- Added offline regression tests and CI artifact for per-MIC research-only status. The script never imports or publishes prices. Verify CI and real provider responses after this commit; no COMPLETE or historical backfill.
