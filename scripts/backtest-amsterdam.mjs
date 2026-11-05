// Historical baseline only. No advice and no claim of forecast skill.
// Decisions use observations up to signal day; outcomes use subsequent bars.
import {readFile} from 'node:fs/promises';
import {validateHistoryDocument} from '../chart.js';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const manifest=await read('data/amsterdam-history-manifest.json');
const horizons=[{label:'3 maanden',days:63},{label:'6 maanden',days:126},{label:'12 maanden',days:252}];
const thresholds=[0.10,0.20,0.30];
const results=new Map();
for(const h of horizons)for(const t of thresholds)results.set(h.label+'|'+t,{horizon:h.label,threshold:t*100,signals:0,hits:0,baselineSignals:0,baselineHits:0,companies:0});
let skipped=0;
const holdoutStart='2025-01-01';
const minimumGapDays=21;
for(const [id,instrument] of Object.entries(manifest.instruments)){
 const doc=await read('data/history/'+id+'.json');
 const bars=validateHistoryDocument(doc,{isin:id,symbol:instrument.symbol,mic:'XAMS'});
 // Momentum needs 126 prior trading bars; every outcome must mature before evaluation.
 if(bars.length<190){skipped++;continue;}
 // One fixed calendar holdout prevents different instruments from testing different eras.
 const firstIndex=bars.findIndex(b=>b.date>=holdoutStart);
 if(firstIndex<0){skipped++;continue;}
 const first=Math.max(126,firstIndex);
 if(first>=bars.length-63){skipped++;continue;}
 for(const h of horizons){
  if(first>=bars.length-h.days)continue;
  for(const t of thresholds)results.get(h.label+'|'+t).companies++;
  for(let i=first;i<bars.length-h.days;i+=Math.max(h.days,minimumGapDays)){
   const current=bars[i].close,old=bars[i-126].close,future=bars[i+h.days].close;
   if(!(current>0&&old>0&&future>0))continue;
   // Raw OHLC can contain corporate actions; flag these results as diagnostic only.
   const momentum=current/old-1;
   const forward=future/current-1;
   for(const t of thresholds){
    const r=results.get(h.label+'|'+t);
    r.baselineSignals++;
    if(forward>=t)r.baselineHits++;
    if(momentum>=0.10){r.signals++;if(forward>=t)r.hits++;}
   }
  }
 }
}
const rows=[...results.values()].map(r=>({...r,hitRate:r.signals?r.hits/r.signals:null,baselineRate:r.baselineSignals?r.baselineHits/r.baselineSignals:null,lift:r.signals&&r.baselineSignals?(r.hits/r.signals)/(r.baselineHits/r.baselineSignals||Infinity):null}));
console.log(JSON.stringify({method:'FIXED_6M_MOMENTUM_10PCT',holdoutStart,signalSpacing:'NON_OVERLAPPING_PER_HORIZON',status:'RESEARCH_ONLY',caveats:['Daily bar counts approximate calendar horizons','Historical adjusted prices and corporate actions not independently verified','Signals spaced by horizon per instrument; cross-company correlations and survivorship bias remain; no transaction costs','Not a trained predictive model and not investment advice'],skippedCompanies:skipped,results:rows},null,2));
