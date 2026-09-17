import fs from 'node:fs/promises';
const root=process.argv[2]||'research/output/machine2-deep';
const a=JSON.parse(await fs.readFile(`${root}/autonomous-analysis.json`,'utf8'));
const g=JSON.parse(await fs.readFile(`${root}/statistical-guard.json`,'utf8'));
const stable=new Map((a.familyStability||[]).map(x=>[x.key,x]));
const proposals=[];
for(const r of g.rows||[]){
 if(r.discoveryStatus!=='FDR_OVERLEEFT_DISCOVERY'||!(r.lift>0)||r.n<250)continue;
 const familyKey=`${r.family}|${r.bucket}`;const s=stable.get(familyKey);
 proposals.push({id:`M2-${r.family}-${r.bucket}-${r.horizon}`.replace(/[^A-Z0-9_-]/gi,'_'),family:r.family,bucket:r.bucket,horizon:r.horizon,n:r.n,lift:r.lift,directionAccuracy:r.directionAccuracy,fdrQ:r.fdrQ,stableAcrossHorizons:Boolean(s?.stableDirection&&s?.positiveHorizons>=2),status:'VOORSTEL_VOOR_BLINDE_TEST',mayTeachMachine1:false,requiredBeforeTeaching:['onaangeraakte tijdsperiode','purged/block validatie wegens overlappende horizons','minstens één andere markt wanneer beschikbaar','geen point-in-time of survivorship lek','economisch plausibele verklaring of robuuste empirische stabiliteit']});
}
await fs.writeFile(`${root}/machine1-teaching-proposals.json`,JSON.stringify({generatedAt:new Date().toISOString(),proposals,rule:'Machine 2 leert Machine 1 nooit direct. Alleen een voorstel dat alle onafhankelijke validatiepoorten doorstaat mag later als nieuwe modelversie worden aangeboden.'},null,2));
console.log(`teaching proposals=${proposals.length}`);