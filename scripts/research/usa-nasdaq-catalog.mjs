import {classifyUSListing, classifySummary} from './usa-security-type.mjs';
// SEC FY2024 10-K (filed 2025-02-18) confirms actual listing history.
const PLTR_TRANSFER=Object.freeze({
  issuerCIK:'0001321655',shareClass:'Class A Common Stock',evidenceAvailableAt:'2025-02-18',
  evidenceUrls:['https://www.sec.gov/Archives/edgar/data/1321655/000132165524000219/pltr-20241114.htm',
    'https://www.sec.gov/Archives/edgar/data/1321655/000132165525000022/pltr-20241231.htm'],
  periods:[{mic:'XNYS',from:'2020-09-30',through:'2024-11-25'},
    {mic:'XNAS',from:'2024-11-26',through:null}]
});
export function pltrMICAt(date){
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
  const d=new Date(date+'T00:00:00Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)return null;
  return date<'2020-09-30'?null:date<='2024-11-25'?'XNYS':'XNAS';
}
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
    const isPLTR=r.Symbol==='PLTR';
    if(isPLTR){
      if(r['Security Name']!=='Palantir Technologies Inc. - Class A Common Stock'||c.type!=='COMMON_CANDIDATE')
        throw Error('PLTR_SEC_ISSUER_OR_SHARE_CLASS_CONFLICT');
      const m=/^(\d{2})(\d{2})(\d{4})\d{2}:\d{2}$/.exec(meta.sourceTimestamp||'');
      if(!m||`${m[3]}-${m[1]}-${m[2]}`<'2024-11-26')
        throw Error('PLTR_NASDAQ_DIRECTORY_PREDATES_TRANSFER');
    }
    return {symbol:r.Symbol,name:r['Security Name'],exchange:'XNAS',listingKey:'XNAS:'+r.Symbol,
      marketCategory:r['Market Category'],financialStatus:r['Financial Status'],
      financialStatusReviewRequired:r['Financial Status']!=='N',roundLotSize:Number(r['Round Lot Size']),
      isin:null,isinStatus:'NOT_IN_OFFICIAL_DIRECTORY',securityType:c.type,securityTypeReason:c.reason,
      ...(isPLTR?{issuerCIK:PLTR_TRANSFER.issuerCIK,shareClass:PLTR_TRANSFER.shareClass,
        historicalListingEvidence:{periods:PLTR_TRANSFER.periods,
          evidenceAvailableAt:PLTR_TRANSFER.evidenceAvailableAt,
          evidenceUrls:PLTR_TRANSFER.evidenceUrls,
          status:'SEC_REPORTED_NOT_PIT_CERTIFIED'},
        activeTradingStatus:'UNVERIFIED',officialListingVerified:false}:{}),
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
