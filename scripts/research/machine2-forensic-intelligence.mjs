import fs from 'node:fs/promises';
const root=process.argv[2]||'research/output/machine2-deep';
const dir=`${root}/dossiers`;
const files=(await fs.readdir(dir)).filter(f=>f.endsWith('.json'));
const horizons=['3m','6m','12m','24m'];
const out=[];
const sign=x=>x>0?'STIJGING':x<0?'DALING':'VLAK';
const mag=x=>Math.abs(x)>=.5?'EXTREEM':Math.abs(x)>=.25?'GROOT':Math.abs(x)>=.10?'DUIDELIJK':'KLEIN';
for(const f of files){
 const d=JSON.parse(await fs.readFile(`${dir}/${f}`,'utf8'));
 for(const p of d.predictions||[]){
  const evidence=(d.evidence||[]).filter(e=>e.pointInTimeEligible);
  const families={};
  for(const e of evidence){const v=Number(e.normalizedSignal??e.value); if(!Number.isFinite(v))continue;(families[e.family]??=[]).push(v)}
  const context={}; for(const [k,a] of Object.entries(families))context[k]=a.reduce((s,v)=>s+v,0)/a.length;
  for(const h of horizons){
   const pred=p.predictions?.[h], actual=p.realized?.[h]; if(!Number.isFinite(pred)||!Number.isFinite(actual))continue;
   const correct=Math.sign(pred)===Math.sign(actual);
   const surprise=actual-pred;
   out.push({instrument:d.instrument||d.isin||null,predictionDate:d.cutoff||p.predictionDate||null,horizon:h,prediction:pred,actual,correct,outcome:sign(actual),magnitude:mag(actual),surprise,knownAtT:context,diagnosis:{predictionDirection:sign(pred),realizedDirection:sign(actual),errorType:correct?'RICHTING_GOED':'RICHTING_FOUT',underestimated:correct&&Math.abs(actual)>Math.abs(pred),overestimated:correct&&Math.abs(actual)<Math.abs(pred),counterMove:!correct}});
  }
 }
}
await fs.writeFile(`${root}/forensic-cases.jsonl`,out.map(x=>JSON.stringify(x)).join('\n')+'\n');
const buckets={};
for(const r of out){const k=`${r.horizon}|${r.outcome}|${r.magnitude}`;const b=buckets[k]??={n:0,correct:0,sumActual:0,sumSurprise:0};b.n++;b.correct+=r.correct?1:0;b.sumActual+=r.actual;b.sumSurprise+=r.surprise;buckets[k]=b}
const summary=Object.entries(buckets).map(([key,b])=>({key,n:b.n,directionAccuracy:b.correct/b.n,meanActual:b.sumActual/b.n,meanSurprise:b.sumSurprise/b.n})).sort((a,b)=>b.n-a.n);
await fs.writeFile(`${root}/forensic-summary.json`,JSON.stringify({generatedAt:new Date().toISOString(),cases:out.length,summary,principle:'Known-at-T evidence verklaart voorspelbaarheid; future evidence mag uitsluitend achteraf verklaren waarom de uitkomst afweek en mag nooit teruglekken.'},null,2));
console.log(`forensic cases=${out.length}`);