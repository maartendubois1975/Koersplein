import {classifyUSListing, classifySummary} from './usa-security-type.mjs';
// Current Nasdaq directory is NOT a historical point-in-time universe or proof of common equity.
export function buildNasdaqCatalog(rows, meta) {
  if (!Array.isArray(rows) || rows.length < 1000) throw Error('UNEXPECTEDLY_SMALL_NASDAQ_DIRECTORY');
  const symbols=new Set();
  for (const r of rows) {
    if (!['Q','G','S'].includes(r['Market Category'])) throw Error('INVALID_NASDAQ_MARKET_CATEGORY:'+r.Symbol);
    if (!['Y','N'].includes(r.NextShares)) throw Error('INVALID_NASDAQ_NEXTSHARES_FLAG:'+r.Symbol);
    if (!/^[1-9]\d*$/.test(r['Round Lot Size'])) throw Error('INVALID_NASDAQ_ROUND_LOT:'+r.Symbol);
    if (symbols.has(r.Symbol)) throw Error('DUPLICATE_NASDAQ_SYMBOL:'+r.Symbol);
    symbols.add(r.Symbol);
  }
  const live=rows.filter(r=>r['Test Issue']==='N');
  const excludedETFs=live.filter(r=>r.ETF==='Y').length;
  const excludedNextShares=live.filter(r=>r.ETF==='N'&&r.NextShares==='Y').length;
  const securities=live.filter(r=>r.ETF==='N'&&r.NextShares==='N').map(r=>{
    const c=classifyUSListing({symbol:r.Symbol,name:r['Security Name'],etf:r.ETF,testIssue:r['Test Issue']});
    return {symbol:r.Symbol,name:r['Security Name'],exchange:'XNAS',listingKey:'XNAS:'+r.Symbol,
      marketCategory:r['Market Category'],financialStatus:r['Financial Status'],
      financialStatusReviewRequired:r['Financial Status']!=='N',roundLotSize:Number(r['Round Lot Size']),
      isin:null,isinStatus:'NOT_IN_OFFICIAL_DIRECTORY',securityType:c.type,securityTypeReason:c.reason,
      source:meta.source,sourceTimestamp:meta.sourceTimestamp,priceHistoryStatus:'NOT_FETCHED',
      verifiedCommonStock:false,eligibleForTraining:false};
  });
  const summary={generatedAt:meta.generatedAt,exchange:'XNAS',source:meta.source,
    sourceTimestamp:meta.sourceTimestamp,sourceSha256:meta.sourceSha256,
    totalNasdaqListings:rows.length,excludedTestIssues:rows.length-live.length,
    excludedETFs,excludedNextShares,nonETFCandidates:securities.length,
    classificationHints:classifySummary(securities),
    flaggedFinancialStatus:securities.filter(r=>r.financialStatusReviewRequired).length,
    verifiedCommonStocks:0,verifiedISINs:0,historicalBarsFetched:0,usableForTraining:0,
    historicalDelistedCoverageVerified:false,corporateActionsVerified:false,distributionRightsApproved:false,
    status:'UNIVERSE_ONLY_NOT_HISTORICALLY_VALIDATED',
    note:'Heuristic types; current listings exclude delisted stocks and have no ISIN. Not PIT or trainable.'};
  return {securities,summary};
}
