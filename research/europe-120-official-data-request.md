# Europe 120 — official historical data acquisition batch

Source: `research/europe-missing-120-dossier.csv`. This request list contains **120** exchange-specific listings and is **not** an import or proof that the listed instruments traded.

## Official data request

Request, for each MIC + ISIN + ticker combination in `research/europe-120-official-data-request.csv`, the listing's actual MIC, first/last trading dates, delisting/transfer/corporate-action history, trading currency, and historical daily OHLC + volume (as far back as available, preferably 1990–2026). If no executions occurred, request an official no-trades/no-listing statement; do not substitute another venue's prices.

| MIC | Count |
|---|---:|
| XPAR | 53 |
| XLON | 19 |
| XCYS | 11 |
| XAMS | 10 |
| XBRU | 9 |
| XLIS | 5 |
| XZAG | 3 |
| XMAL | 2 |
| XSWX | 2 |
| XBRA | 1 |
| XDUB | 1 |
| XETR | 1 |
| XLJU | 1 |
| XRIS | 1 |
| XTAL | 1 |

**Euronext initial batch:** 78 listings across XPAR, XAMS, XBRU, XLIS, XDUB. Official contact: datasolutions@euronext.com. Request NextHistory Cash EOD or Web Services historical data with rights for public display, including exact MIC mapping, not just raw data delivery.

## Acceptance gate

Do not publish a bar until its date, open, close, currency, MIC, ISIN, source provenance, redistribution license and historical trading status have been verified. Import must be append-only and rerun the 31-market live coverage audit. Unverified listings remain missing, not fabricated or silently deleted.
