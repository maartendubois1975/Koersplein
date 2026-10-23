# European provider failure triage — 2026-10-22 run 39861054608
Source: parsed EUROPE_MARKET_DONE JSON from all eight update-and-verify GitHub Actions job logs. These are **import attempts**, not the same metric as 784 missing daily OHLC records. No production write performed.

| Market | Failed imports | Main causes |
|---|---:|---|
| XSWX Switzerland | 233 | SOURCE_NO_HISTORY 223, PROVIDER_OTHER 4, RATE_LIMIT 2, AUTH_OR_ACCESS 4 |
| XLON London | 79 | PROVIDER_OTHER 60, SOURCE_NO_HISTORY 18, AUTH_OR_ACCESS 1 |
| XCYS Cyprus | 39 | PROVIDER_OTHER 27, SOURCE_NO_HISTORY 11, AUTH_OR_ACCESS 1 |
| XMAL Malta | 29 | PROVIDER_OTHER 26, SOURCE_NO_HISTORY 2, AUTH_OR_ACCESS 1 |
| XETR Xetra | 11 | PROVIDER_OTHER 8, SOURCE_NO_HISTORY 2, AUTH_OR_ACCESS 1 |
| XAMS Amsterdam | 10 | SOURCE_NO_HISTORY 5, PROVIDER_OTHER 5 |
| XBRU Brussels | 9 | SOURCE_NO_HISTORY 8, AUTH_OR_ACCESS 1 |
| XLJU Ljubljana | 9 | SOURCE_NO_HISTORY 8, PROVIDER_OTHER 1 |
| XBRA Bratislava | 8 | SOURCE_NO_HISTORY 6, AUTH_OR_ACCESS 2 |
| XBUL Bulgaria | 7 | SOURCE_NO_HISTORY 7 |
| Other 20+ markets | Remaining | Mixed categories; inspect source logs |

Top four markets XSWX+XLON+XCYS+XMAL = 380 failed imports, about 77% of 491. Switzerland and London alone = 312, about 64%.

## Action order
1. **XSWX:** obtain independently licensed SIX-compatible historical/daily source, check ISIN+MIC+currency. Repeated Yahoo retries are not an adequate fix for 223 SOURCE_NO_HISTORY.
2. **XLON:** split PROVIDER_OTHER into exact causes from per-instrument examples; check symbol normalization, venue and exchange suffix before buying more source access.
3. **XCYS and XMAL:** same provider error decomposition; verify local exchange data feeds.
4. **Other exchanges:** prioritize by missing OHLC, not only import failure counts.
5. Run independent four-market EODHD read-only bulk pilot only if API secret and rights are available; that pilot currently covers PA/XETRA/BR/SW, not London, Cyprus or Malta.
6. Production cutover requires measured daily OHLC improvement, read-only dry run, append-only integrity, and verified redistribution rights.

## Hard blockers
No verified EODHD token, live source output, or redistribution license in the available evidence. Do not mark fixed until the daily audit's missingOpenClose count falls and the new data's provenance is recorded.
