# Paris equity inventory audit — 2026-10-21

## Verified repository snapshot
Source: `data/euronext-paris.json`; official Euronext product-directory export dated 2026-09-20T04:34:11.191Z.

| MIC | Venue | Instrument rows |
| --- | --- | ---: |
| XPAR | Euronext Paris | 337 |
| ALXP | Euronext Growth Paris | 293 |
| XMLI | Euronext Access Paris | 140 |
| **Total** | | **770** |

All 770 rows have syntactically valid ISIN identifiers. There are zero duplicate (ISIN, MIC) keys. The source download URL includes XPAR, ALXP, XMLI, MLXP, TNLP and ENXP, but no entries in the stored snapshot use the last three MICs.

## Independent official documentation
Euronext's April 2026 equity settlement scope lists XPAR, ALXP and XMLI as Paris equity venues: https://www.euronext.com/sites/default/files/2026-04/European%20Offering%20-%20OTC%20Settlement%20Flows%20English%20Version_0.pdf

Official directory: https://live.euronext.com/en/products/equities/list
Snapshot source: https://live.euronext.com/en/product_directory/data/stocks-paris/download?mics=XPAR%2CALXP%2CXMLI%2CMLXP%2CTNLP%2CENXP

## Outstanding verification before claiming block 1 complete
- Fetch a fresh current-day official Euronext export; the current snapshot is from September 20.
- Confirm issue type for every row (ordinary/preferred shares vs rights/certificates and other instruments).
- Confirm active admission/trading status and detect new listings/delistings since the snapshot.
- Produce a versioned full ISIN+MIC diff against the refreshed export.

**Do not claim 770 is today's definitive tradable-share count, and do not modify the existing 717 historical price series based on this audit.**
