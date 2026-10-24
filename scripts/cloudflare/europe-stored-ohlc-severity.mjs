import {parseOhlcPrice} from './europe-run-policy.mjs';
// Read-only severity audit of the *stored* historical OHLC snapshots.
// This does not infer a correct price, authorize a replacement, or write bars.
const FIELDS=['open','high','low','close'];
const BUCKETS=['UNDER_1_BPS','FROM_1_TO_10_BPS','FROM_10_TO_100_BPS','FROM_100_TO_1000_BPS','AT_LEAST_1000_BPS','INVALID_OR_MISSING_FIELDS','FLAGGED_WITHOUT_VIOLATION'];
function emptyCounts(){return Object.fromEntries(BUCKETS.map(key=>[key,0]));}
export function storedOhlcViolationSeverity(bar){
 const prices=bar&&Object.fromEntries(FIELDS.map(key=>[key,parseOhlcPrice(bar[key])]));
 if(!prices||FIELDS.some(key=>prices[key]===null))return {bucket:'INVALID_OR_MISSING_FIELDS',violationBps:null,readOnly:true};
 const {open,high,low,close}=prices;
 const top=Math.max(open,close),bottom=Math.min(open,close);
 const deficitHigh=Math.max(0,(top-high)/top*10000);
 const excessLow=Math.max(0,(low-bottom)/bottom*10000);
 const reversedRange=Math.max(0,(low-high)/Math.max(low,high)*10000);
 const violationBps=Math.max(deficitHigh,excessLow,reversedRange);
 const bucket=violationBps===0?'FLAGGED_WITHOUT_VIOLATION':
   violationBps<1?'UNDER_1_BPS':violationBps<10?'FROM_1_TO_10_BPS':
   violationBps<100?'FROM_10_TO_100_BPS':violationBps<1000?'FROM_100_TO_1000_BPS':'AT_LEAST_1000_BPS';
 return {bucket,violationBps,readOnly:true};
}
export function summarizeStoredOhlcSeverity(queue){
 if(!Array.isArray(queue?.markets))throw Error('Recovery queue markets unavailable: severity cannot be verified');
 const overall=emptyCounts(),byMarket=[],seen=new Map();
 let examined=0,duplicateDates=0,conflictingSnapshots=0;
 for(const market of queue.markets){
  if(typeof market.mic!=='string'||!Array.isArray(market.recentOhlcDebt)){
   if(market.recentOhlcDebt===undefined)continue;
   throw Error('Invalid historical debt for '+String(market.mic));
  }
  const counts=emptyCounts();let total=0,severe=0,highestBps=0;
  for(const row of market.recentOhlcDebt){
   if(row.auditReason!=='INCOMPLETE_OR_INVALID_OHLC'||row.mic!==market.mic||typeof row.isin!=='string'||typeof row.lastStoredDate!=='string')throw Error('Invalid stored OHLC evidence in '+market.mic);
   const key=[row.mic,row.isin,row.lastStoredDate].join('|');
   if(seen.has(key)){
    duplicateDates++;
    if(JSON.stringify(seen.get(key))!==JSON.stringify(row.storedOhlc??null))conflictingSnapshots++;
    continue;
   }
   seen.set(key,row.storedOhlc??null);
   const severity=storedOhlcViolationSeverity(row.storedOhlc);
   counts[severity.bucket]++;overall[severity.bucket]++;examined++;total++;
   if(severity.violationBps!==null){highestBps=Math.max(highestBps,severity.violationBps);if(severity.violationBps>=100)severe++;}
  }
  if(total)byMarket.push({mic:market.mic,examined:total,atLeast100Bps:severe,shareAtLeast100Bps:severe/total,maximumViolationBps:highestBps,counts});
 }
 byMarket.sort((a,b)=>b.examined-a.examined||a.mic.localeCompare(b.mic));
 const expected=Number.isSafeInteger(queue?.totals?.recentOhlcDebtDates)?queue.totals.recentOhlcDebtDates:null;
 const complete=expected!==null&&examined===expected&&duplicateDates===0&&conflictingSnapshots===0;
 return {readOnly:true,complete,expectedDebtDates:expected,metric:'INTRINSIC_STORED_CANDLE_VIOLATION_NOT_SOURCE_COMPARISON',scope:'RECENT_STORED_HISTORY',examined,duplicateDates,conflictingSnapshots,counts:overall,byMarket};
}
