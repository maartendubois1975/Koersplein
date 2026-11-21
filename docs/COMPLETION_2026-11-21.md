# Koersplein — source basis and successor acceptance, 21 November 2026

## Scope and protection

Only consolidation-20261116 and Render test srv-dajuqaek1f9s739gu8kg. No production, main or Cloudflare changes. Approved company membership and identity digests stay 80/105/664/16/34 (899). The Paris research derivative remains byte-for-byte generated from the original decision ledger; current listings are derived from the existing central instrument-events file. No second importer or workflow.

## Verified source research

Euronext historical POST recovered from HTTP 503 to HTTP 200 on 21 November. Retry of run 44800564767 completed its required market/archive/verify/tests; only direct Render publication still lacked the secret. Tested commit b320ae0b147fc874a4137f1f59c87557fc23d23f was published via the connected service as dep-dc0i61bm8hqs73ejnp3g, live 04:57:07 UTC.

Fresh official adjusted=N histories were collected for all 50 Dublin/Lisbon companies, using their approved ISIN, segment MIC and source URL. Fresh Yahoo comparisons were also collected for the 33 disputed instruments. The three Dublin Growth Yahoo labels failed the existing strict venue alias check and were not promoted or used for import. The official source is independently bound to the approved listing.

The key cause was mixed price bases: Euronext adjusted=Y was being combined with raw Yahoo OHLC and volume. EDPR on 2025-11-20 is a concrete example: adjusted close 11.447788, raw close 11.55. Unadjusted official volume is 1,330,437; adjusted volume 1,342,315. NOS shows the same basis issue. Other dated disagreements are corrected old source observations, including partial volume/OHLC. No corporate-action factor is inferred or fabricated.

## Central correction

The existing provider and official snapshot now explicitly default to adjusted=N, with UNADJUSTED provenance metadata. Explicit research requests for adjusted=Y remain possible and labeled EURONEXT_ADJUSTED. Existing stored bars are not rewritten.

The central chart merger consumes reviewed, identity-scoped source decisions in data/history-chart-resolutions.json. The decisions reference both exact input observations and the actual retrieved official unadjusted row. If either observation, identity or source mode changes, the decision is rejected and the chart stays blocked until reviewed again. A materially different unreviewed OHLC or volume still fails closed. No company-specific code exception or broad numeric tolerance is introduced.

All 434 disputed dates for 33 companies are reviewed. 230 existing base records are preserved exactly. The displayed value for 204 dates follows the directly observed official unadjusted row; both original sources stay unchanged on disk and in the evidence dossier. No historical archive has been deleted or overwritten. All 50 actual Dublin/Lisbon merges pass after the review. The graph discloses the reviewed source decisions and remains a raw-price chart, not a validated total-return series.

Normalized official observations and transport response checksums are frozen in research/completion/2026-11-21/chart-source-review.json.gz. Encrypted HTTP bodies are not embedded. The immutable source archives and this dated review remain distinct.

## Toosla successor

Issuer admission and the official new-ISIN quote are proven. The separate raw successor history FR001401B9V8 contains three executed sessions, 18–20 November. No executed 17-November bar was manufactured. The old ISIN FR00140062B9 remains quarantined from the issuer effective date, 17 November. No old/new price join is performed.

The stable company register retains the company and old membership identifier. The existing instrument-events file declares the verified successor and operational activation for session 20 November. Server and browser derive the current listing from that single event. Before that operational session, older archived snapshots retain their original identity and evidence. The current public list uses the new ISIN; the old historical link remains available as a distinct retired listing. The company is counted once.

Only an unverified predecessor row explicitly naming the approved successor may migrate on reimport. Its entire old evidence is retained in retiredIdentityEvidence. A proven predecessor trade or no-trade record cannot be silently migrated. Old and new history documents remain separate. This prevents a 3,334-for-one conversion from becoming a false investment return.

## Remaining Paris history evidence

All 28 previously missing Access histories were queried again with adjusted=N over the one-year range through 20 November. Every source response succeeded but none contained an executed positive-volume complete OHLC bar. The actual reference-row counts and source URLs are frozen in paris-raw-recheck.json. Absence of returned historical trades is not asserted to prove that an instrument has never traded. No missing OHLC values are invented.

## Validation and deployment gate

Local npm test, history:test, audit:codebase, all research regressions, export-paris-company-review --check and git diff --check pass. Added tests replay actual official rows, enforce the raw request, validate all 434 decisions, preserve the immutable sources, reject altered source/mode/MIC data and test successor collection, controlled snapshot migration and separate publication. Code audit has zero errors and one preexisting Oslo source-diversity warning.

This file is written before the single integrated GitHub acceptance run. Final commit/run/deploy IDs, live browser checks and remaining status belong in the final delivery report. No claim of deployment or unattended publication follows merely from a passing local test.

Rollback: restore the prior test deployment for presentation. Keep every historical file and source observation. Once successor snapshots exist, do not remap new-ISIN prices onto the predecessor; preserve the listing-event adapter or explicitly stop that market's writes. Never delete data to make a rollback or test green.
