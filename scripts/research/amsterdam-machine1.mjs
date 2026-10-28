import fs from 'node:fs/promises';

const API=(process.env.KOERSPLEIN_API_URL||'').replace(/\/$/,'');
// Local verified Amsterdam history is the default; remote API is an optional fallback.
const catalog=JSON.parse(await fs.readFile('data/euronext-amsterdam.json','utf8'));
const instruments=(Array.isArray(catalog)?catalog:(catalog.instruments||catalog.shares||[])).filter(x=>x.displayPolicy!=='cross-market-reference-only');
const pct=(a,b)=>a&&b?(b/a-1):null;
const monthKey=d=>d.slice(0,7);
const utcMonthEnd=key=>new Date(Date.UTC(Number(key.slice(0,4)),Number(key.slice(5,7)),0)).toISOString().slice(0,10);
const addMonths=(date,n)=>{const d=new Date(date+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,10)};
const nearest=(bars,date)=>bars.find(b=>b.date>=date)||null;
const daysBetween=(a,b)=>(Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000;
const lastAvailable=bars=>bars.at(-1)?.date||null;
const history=async isin=>{try{return JSON.parse(await fs.readFile('data/history/'+isin+'.json','utf8'))}catch(e){if(!API)throw e;const r=await fetch(`${API}/api/history/${encodeURIComponent(isin)}`);if(!r.ok)throw new Error(`history ${r.status}`);return r.json()}};
const getBars=x=>Array.isArray(x)?x:(x.bars||x.records||x.history||[]);
const results=[];let failed=0;
for(const item of instruments){
 try{
  const raw=await history(item.isin); const bars=getBars(raw).filter(b=>b?.date&&Number.isFinite(Number(b.close))).map(b=>({...b,close:Number(b.close)})).sort((a,b)=>a.date.localeCompare(b.date));
  if(bars.length<260) continue;
  const monthly=[];let last='';for(const b of bars){const k=monthKey(b.date);if(k!==last){monthly.push(b);last=k;}else monthly[monthly.length-1]=b;}
  const staleMonthly=monthly.filter(b=>daysBetween(b.date,utcMonthEnd(monthKey(b.date)))>5);
  if(staleMonthly.length)console.warn(JSON.stringify({isin:item.isin,staleMonthlyPrices:staleMonthly.length,examples:staleMonthly.slice(0,3).map(b=>b.date)}));
  for(let i=12;i<monthly.length;i++){
   if(daysBetween(monthly[i].date,utcMonthEnd(monthKey(monthly[i].date)))>5)continue;
   const now=monthly[i], m3=monthly[Math.max(0,i-3)],m6=monthly[Math.max(0,i-6)],m12=monthly[Math.max(0,i-12)];
   const signals={momentum3m:pct(m3.close,now.close),momentum6m:pct(m6.close,now.close),momentum12m:pct(m12.close,now.close)};
   // Baseline v1: puur point-in-time prijsmodel. Geen toekomstige of nog niet ingelezen fundamentele/news-data.
   const score=(signals.momentum3m??0)*.2+(signals.momentum6m??0)*.3+(signals.momentum12m??0)*.5;
   const predictions={};const realized={};
   for(const h of [3,6,12,24]){predictions[`${h}m`]=score;const maturity=addMonths(now.date,h);const future=lastAvailable(bars)>=maturity?nearest(bars,maturity):null;realized[`${h}m`]=future?pct(now.close,future.close):null;}
   const sharedCutoff=utcMonthEnd(monthKey(now.date));
   results.push({instrument:item.isin,ticker:item.ticker||item.symbol,company:item.company||item.name,predictionDate:sharedCutoff,sourcePriceDate:now.date,informationCutoff:sharedCutoff,modelVersion:'machine1-price-baseline-v1',availableSignals:signals,missingSignals:['fundamentals-point-in-time','analyst-revisions','news-sentiment','macro-point-in-time','flows-options-short'],predictions,realized});
  }
 }catch(e){failed++;console.error(JSON.stringify({isin:item.isin,error:e.message}));}
}
await fs.mkdir('research/output',{recursive:true});
const summary={generatedAt:new Date().toISOString(),market:'XAMS',mode:'BLIND_WALK_FORWARD',modelVersion:'machine1-price-baseline-v1',instruments:instruments.length,observations:results.length,failed,strictPointInTime:true,sharedMonthlyCalendarCutoff:true,maxSourcePriceStalenessCalendarDays:5,note:'Calendar-aligned research v2: all monthly observations share UTC calendar-month-end cutoff; price comes from latest available prior trade, with sourcePriceDate retained for staleness audit. Historical test outcomes from v1 are invalidated; no production promotion.'};
await fs.writeFile('research/output/amsterdam-machine1-summary.json',JSON.stringify(summary,null,2));
await fs.writeFile('research/output/amsterdam-machine1-results.jsonl',results.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify(summary,null,2));
