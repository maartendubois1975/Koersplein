// Evidence-only diagnostics for already stored OHLC records. No price repair,
// interpolation, history mutation, or assumption that a missing high/low means no trade.
import {parseOhlcPrice} from './europe-run-policy.mjs';
const FIELDS=['open','high','low','close'];
const isValidDate=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00Z');
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
};
export function describeOhlcDefects(bar){
 if(!bar||typeof bar!=='object')return ['BAR_MISSING'];
 const defects=[];
 if(!isValidDate(bar.date))defects.push('INVALID_DATE');
 const prices={};
 for(const field of FIELDS){
  const raw=bar[field];
  if(raw===null||raw===undefined||raw===''){
   defects.push('MISSING_'+field.toUpperCase());
   continue;
  }
  const price=parseOhlcPrice(raw);
  if(price===null){defects.push('INVALID_'+field.toUpperCase());continue;}
  prices[field]=price;
 }
 if(Number.isFinite(prices.high)&&Number.isFinite(prices.low)&&prices.high<prices.low)defects.push('HIGH_BELOW_LOW');
 if(Number.isFinite(prices.high)&&Number.isFinite(prices.open)&&prices.high<prices.open)defects.push('HIGH_BELOW_OPEN');
 if(Number.isFinite(prices.high)&&Number.isFinite(prices.close)&&prices.high<prices.close)defects.push('HIGH_BELOW_CLOSE');
 if(Number.isFinite(prices.low)&&Number.isFinite(prices.open)&&prices.low>prices.open)defects.push('LOW_ABOVE_OPEN');
 if(Number.isFinite(prices.low)&&Number.isFinite(prices.close)&&prices.low>prices.close)defects.push('LOW_ABOVE_CLOSE');
 return defects;
}
export function countOhlcDefects(missing){
 const counts={};
 for(const item of missing||[]){
  if(item.reason!=='INCOMPLETE_OR_INVALID_OHLC')continue;
  const defects=Array.isArray(item.ohlcDefects)&&item.ohlcDefects.length?new Set(item.ohlcDefects):new Set(['UNCLASSIFIED_INCOMPLETE_OHLC']);
  for(const defect of defects)counts[defect]=(counts[defect]||0)+1;
 }
 return Object.fromEntries(Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])));
}

 
// Shared read-only canonical fingerprint for stored OHLC provenance.
// Decimal legacy strings compare numerically; invalid raw types retain their
// type/value identity and are never treated as validated price evidence.
export function canonicalStoredOhlcSignature(bar){
 if(!bar||typeof bar!=='object')return JSON.stringify(bar??null);
 return JSON.stringify(FIELDS.map(key=>{
   const value=bar[key];
   if(value===null||value===undefined||value==='')return null;
   const number=parseOhlcPrice(value);
   // Keep invalid raw type/value provenance: String(true) and String('true')
   // collide, as do distinct objects. Never silently merge contradictory
   // stored rows simply because both failed the strict price parser.
   return number===null?JSON.stringify([typeof value,value]):number;
  }));
}

// Independently expose contradictory stored rows for the same session.
// The ordinary defect counter intentionally prefers a complete duplicate,
// but that can hide a conflicting stored snapshot. Do not change or merge any
// existing bars: this is a separate, evidence-only quarantine signal.
export function inspectStoredOhlcDateConflicts(bars,cutoff,windowDays=30){
 if(!isValidDate(cutoff)||!Number.isInteger(windowDays)||windowDays<1||windowDays>366)throw Error('Invalid stored OHLC conflict window');
 const min=new Date(cutoff+'T00:00:00Z');
 min.setUTCDate(min.getUTCDate()-windowDays+1);
 const windowStart=min.toISOString().slice(0,10),groups=new Map();
 for(const bar of bars||[]){
  const date=bar?.date;
  if(!isValidDate(date)||date<windowStart||date>cutoff)continue;
  if(!groups.has(date))groups.set(date,[]);
  groups.get(date).push(bar);
 }
 const dates=[];
 for(const [date,rows] of groups){
  if(rows.length<2)continue;
  const variants=new Map();
  for(const bar of rows){
   const signature=canonicalStoredOhlcSignature(bar);
   variants.set(signature,describeOhlcDefects(bar).length===0);
  }
  if(variants.size<2)continue; // Identical OHLC rows are not contradictory.
  const completeVariants=[...variants.values()].filter(Boolean).length;
  const invalidVariants=variants.size-completeVariants;
  const category=completeVariants&&invalidVariants?'MIXED_COMPLETE_INVALID_STORED_OHLC':
    completeVariants>1?'CONFLICTING_COMPLETE_STORED_OHLC':'CONFLICTING_INVALID_STORED_OHLC';
  dates.push({date,category,rows:rows.length,distinctOhlc:variants.size});
 }
 dates.sort((a,b)=>a.date.localeCompare(b.date));
 return {readOnly:true,windowStart,windowEnd:cutoff,count:dates.length,dates};
}

// Count historical OHLC debt in the most recent closed calendar window even
// after a newer valid daily candle makes the instrument look current. If
// duplicate rows exist for a date, a complete row prevents a false defect.
export function recentOhlcDebt(bars,cutoff,windowDays=30){
 if(!isValidDate(cutoff)||!Number.isInteger(windowDays)||windowDays<1||windowDays>366)throw Error('Invalid closed-session OHLC debt window');
 const min=new Date(cutoff+'T00:00:00Z');
 min.setUTCDate(min.getUTCDate()-windowDays+1);
 const minDate=min.toISOString().slice(0,10);
 const byDate=new Map();
 for(const bar of bars||[]){
  const day=bar?.date;
  if(!isValidDate(day)||day<minDate||day>cutoff)continue;
  const defects=describeOhlcDefects(bar);
  const old=byDate.get(day);
  if(defects.length===0){byDate.set(day,[]);continue;}
  if(old?.length===0)continue;
  byDate.set(day,[...new Set([...(old||[]),...defects])]);
 }
 const invalidDates=[...byDate].filter(([,defects])=>defects.length).sort(([a],[b])=>a.localeCompare(b)).map(([date,defects])=>({date,defects}));
 return {windowStart:minDate,windowEnd:cutoff,invalidDates};
}
