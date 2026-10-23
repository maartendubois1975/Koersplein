// Evidence-only diagnostics for already stored OHLC records. No price repair,
// interpolation, history mutation, or assumption that a missing high/low means no trade.
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
  const price=Number(raw);
  if(!Number.isFinite(price)||price<=0){defects.push('INVALID_'+field.toUpperCase());continue;}
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
