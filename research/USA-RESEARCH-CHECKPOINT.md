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

## 2026-10-17 07:05 Europe/Amsterdam — TXSE provider route confirmed as research hint
- Live GitHub Action 39004861822 (commit 82bf6c48) passed offline tests and fetched 2026-10-16 dated OHLC from Yahoo for 4/4 XNYS and 3/4 XNAS canaries; GOOG was conservatively skipped because the current classifier marks `Class C Capital Stock` REVIEW.
- TXSE official listing-flag candidates TCBI and DDS returned Yahoo metadata `exchangeName=TEX`, `fullExchangeName=TXSE`, currency USD, instrumentType EQUITY, New York timezone. The first probe correctly rejected unrecognized TEX and preserved no bar. Add a strict TXSE-specific `(TEX,TXSE)` pair rather than guessing a NYSE/Nasdaq route.
- This is provider self-description, not independent MIC/issuer/ISIN/rights approval. Re-run CI and inspect dated TXSE bars before claiming TXSE probe success. No COMPLETE, no historical import, no main/Europe changes.

## 2026-10-17 13:56 Europe/Amsterdam — fail-closed US research canary CI
- Prior USA PR #75 head: fe72adcdc381f1dab7a42224327df9f11b2cadb3. Prior CI run 39004937142 successful; dated 2026-10-16 research canaries: XNYS 4/4, XNAS 3/4, TXSE 2/2. Four CI artifacts inspected by name and head SHA.
- Reproduced structural flaw: live probe could exit successfully with zero current-session OHLC canaries for any MIC. Guard now requires >=1 same-session positive open+close bar for each of XNYS/XNAS/TXSE; stale, previous-only, malformed and empty results fail. Evidence is written before the guard and upload steps use if: always(). Seven standalone regressions and the saved real 2026-10-16 artifact passed offline.
- Research evidence gate only; NO issuer/SEC/ISIN/share-class/active listing or rights approval, no TXSE independent tape validation, no backfill, COMPLETE, merge, training or publication. Next: prove effective-dated official dual listings (SCHW) and PLTR NYSE-to-Nasdaq migration, SEC crosscheck and source rights. Check resulting CI and artifacts before considering this integrated.

## 2026-10-17 17:55 Europe/Amsterdam — TXSE secondary-listing catalog correction
- Previous PR #75 head bae0a40887a8176da2c901f8f2a31da610842e94; main e47c09986e95bdbac9733051f68d6725b0d3feea. Latest US CI 39030669508 green with four research-only artifacts; all GitHub Actions in-progress/queued/waiting queries returned zero before this commit. No overlapping USA writer detected.
- Confirmed official TXSE notice TXSE-2026-006 (2026-10-01): https://www.txse.com/alerts/b73ae818-f4d2-4437-8cc9-8370719ecbe2 ; SEC Form 8-A signed 2026-10-06 (CIK 0000316709): https://www.sec.gov/Archives/edgar/data/316709/000119312526415008/d42491d8a12b.htm . Both announce SCHW common-stock dual listing with XNYS primary and expected effective date 2026-10-07. SEC 8-K 2026-10-15 is NOT listing evidence.
- Root cause: TXSE catalog filtered only TXSEListed=Y and excluded SCHW with TXSEListed=N, despite independent listing evidence. Narrow SCHW-only effective-dated evidence path now records separate TXSE research candidate, original N flag, SEC CIK, NYSE primary, dates and both official URLs; does not convert all TXSE-tradable symbols into TXSE-listed. Incorrect issuer, test/ETF and pre-effective snapshots are fail-closed.
- Offline Node TXSE regression and syntax checks passed, including negative cases for arbitrary N-flag symbols, issuer mismatch, ETF/test and pre-effective dates. GitHub CI/artifact content must be checked for this new commit before integration is considered proven.
- Block 1 still INCOMPLETE: full SEC issuer/share-class/ISIN, actual active-trading status, full XNYS/XNAS/TXSE official catalog reconciliation and history/source rights are unverified. No source gate, backfill, training, merge, publication, COMPLETE or production writes. Next: inspect live TXSE artifact for SCHW separately from flag-Y counts; validate effective-dated listing/active trading and independent SEC/ISIN crosswalk.
