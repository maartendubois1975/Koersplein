// Historical baseline only. No advice and no claim of forecast skill.
// Decisions use observations up to signal day; outcomes use subsequent bars.
import {readFile} from 'node:fs/promises';
import {validateHistoryDocument} from '../chart.js';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const manifest=await read('data/amsterdam-history-manifest.json');
const horizons=[{label:'3 maanden',days:63},{label:'6 maanden',days:126},{label:'12 maanden',days:252}];
const thresholds=[0.10,0.20];
const results=new Map();
for(const h of horizons)for(const t of thresholds)results.set(h.label+'|'+t,{horizon:h.label,threshold:t*100,signals:0,hits:0,baselineSignals:0,baselineHits:0,companies:0});
let skipped=0;
for(const [id,instrument] of Object.entries(manifest.instruments)){
 const doc=await read('data/history/'+id+'.json');
 const bars=validateHistoryDocument(doc,{isin:id,symbol:instrument.symbol,mic:'XAMS'});
 // Last 30% of each instrument's eligible signal dates are a holdout.
 // The momentum rule is fixed beforehand; no threshold fitting on this holdout.
 const eligible=bars.length-252-252;
 if(eligible<40){skipped++;continue;}
 const first=252+Math.floor(eligible*0.7);
 for(const h of horizons){
  for(const t of thresholds)results.get(h.label+'|'+t).companies++;
  for(let i=first;i<bars.length-h.days;i+=21){
   const current=bars[i].close,old=bars[i-126].close,future=bars[i+h.days].close;
   if(!(current>0&&old>0&&future>0))continue;
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
console.log(JSON.stringify({method:'FIXED_6M_MOMENTUM_10PCT',status:'RESEARCH_ONLY',caveats:['Daily bar counts approximate calendar horizons','Historical adjusted prices and corporate actions not independently verified','Overlapping observations; survivorship bias; no transaction costs','Not a trained predictive model and not investment advice'],skippedCompanies:skipped,results:rows},null,2));
