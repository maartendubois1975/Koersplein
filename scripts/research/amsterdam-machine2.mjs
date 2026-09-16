import fs from 'node:fs/promises';

const input=process.argv[2]||'research/input/amsterdam-machine1-results.jsonl';
const lines=(await fs.readFile(input,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
const byInstrument=new Map();
for(const row of lines){if(!byInstrument.has(row.instrument))byInstrument.set(row.instrument,[]);byInstrument.get(row.instrument).push(row);}
const horizons=['3m','6m','12m','24m'];
const buckets={};for(const h of horizons)buckets[h]={n:0,right:0,wrong:0,up:0,down:0,absError:0};
const postmortems=[];
for(const row of lines){
 const horizonReview={};
 for(const h of horizons){
  const p=row.predictions?.[h],r=row.realized?.[h]; if(!Number.isFinite(p)||!Number.isFinite(r))continue;
  const right=Math.sign(p)===Math.sign(r);const b=buckets[h];b.n++;b[right?'right':'wrong']++;b[r>=0?'up':'down']++;b.absError+=Math.abs(p-r);
  horizonReview[h]={predicted:p,realized:r,directionCorrect:right,error:p-r};
 }
 postmortems.push({instrument:row.instrument,ticker:row.ticker,company:row.company,predictionDate:row.predictionDate,machine1ModelVersion:row.modelVersion,predictionFrozen:true,horizonReview,signalsKnownAtT:row.availableSignals||{},signalsMissingAtT:row.missingSignals||[],futureKnowledgeUsedForScoring:true,diagnosis:'PRICE_BASELINE_POSTMORTEM',note:'Machine 2 verandert Machine 1 niet. Deze eerste post-mortem meet systematische fouten en registreert welke signaalfamilies op T ontbraken; causale claims vereisen later point-in-time bronmateriaal.'});
}
const summary={generatedAt:new Date().toISOString(),stage:'FUTURE_POSTMORTEM',market:'XAMS',machine1Observations:lines.length,instruments:byInstrument.size,predictionMutationForbidden:true,results:Object.fromEntries(Object.entries(buckets).map(([h,b])=>[h,{...b,directionAccuracy:b.n?b.right/b.n:null,meanAbsoluteError:b.n?b.absError/b.n:null}])),candidateMissingSignalFamilies:[...new Set(lines.flatMap(x=>x.missingSignals||[]))],importantLimitation:'Deze run mag achteraf uitkomsten zien, maar kan nog niet bewijzen welk ontbrekend fundamenteel/news/macro-signaal destijds kenbaar was. Daarvoor is point-in-time brondata nodig.'};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/amsterdam-machine2-summary.json',JSON.stringify(summary,null,2));
await fs.writeFile('research/output/amsterdam-machine2-postmortems.jsonl',postmortems.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify(summary,null,2));