import fs from 'node:fs/promises';

const root=process.argv[2]||'research/output/machine2-deep';
const dir=`${root}/dossiers`;
const files=(await fs.readdir(dir)).filter(f=>f.endsWith('.json'));
const stats=new Map();

const add=(key,correct,ret)=>{
  const s=stats.get(key)||{n:0,correct:0,sumReturn:0};
  s.n++;
  s.correct+=correct?1:0;
  s.sumReturn+=Number.isFinite(ret)?ret:0;
  stats.set(key,s);
};

for(const f of files){
  const d=JSON.parse(await fs.readFile(`${dir}/${f}`,'utf8'));
  for(const p of d.predictions||[]){
    for(const [h,pred] of Object.entries(p.predictions||{})){
      const actual=p.realized?.[h];
      if(!Number.isFinite(pred)||!Number.isFinite(actual)) continue;
      add(`BASELINE|${h}`,Math.sign(pred)===Math.sign(actual),actual);

      // Eén historische voorspelling mag per signaalfamilie en horizon maar één stem krijgen.
      // Meerdere evidence-regels binnen dezelfde familie worden eerst samengevat.
      const byFamily=new Map();
      for(const e of d.evidence||[]){
        if(!e.pointInTimeEligible) continue;
        const val=Number(e.normalizedSignal??e.value);
        if(!Number.isFinite(val)) continue;
        const arr=byFamily.get(e.family)||[];
        arr.push(val);
        byFamily.set(e.family,arr);
      }
      for(const [family,values] of byFamily){
        const mean=values.reduce((a,b)=>a+b,0)/values.length;
        const bucket=mean>0?'POS':mean<0?'NEG':'ZERO';
        add(`${family}|${bucket}|${h}`,Math.sign(pred)===Math.sign(actual),actual);
      }
    }
  }
}

const candidates=[...stats.entries()]
  .map(([key,s])=>({key,n:s.n,directionAccuracy:s.correct/s.n,meanRealizedReturn:s.sumReturn/s.n}))
  .sort((a,b)=>b.n-a.n);
const hypotheses=candidates
  .filter(x=>!x.key.startsWith('BASELINE')&&x.n>=30)
  .map(x=>({...x,status:'CANDIDATE_ONLY',promotionForbidden:true,nextStep:'BLIND_OUT_OF_SAMPLE_TEST'}));

const maxExpectedPerHorizon={};
for(const c of candidates.filter(x=>x.key.startsWith('BASELINE|'))){
  const h=c.key.split('|')[1];
  maxExpectedPerHorizon[h]=c.n;
}
const integrityViolations=candidates.filter(c=>{
  if(c.key.startsWith('BASELINE|')) return false;
  const h=c.key.split('|').at(-1);
  return c.n>(maxExpectedPerHorizon[h]||0);
});
if(integrityViolations.length) throw new Error(`Dubbeltelling gedetecteerd: ${JSON.stringify(integrityViolations.slice(0,5))}`);

await fs.writeFile(`${root}/learning-summary.json`,JSON.stringify({
  generatedAt:new Date().toISOString(),
  dossiers:files.length,
  candidates,
  hypotheses,
  integrity:{dedupeKey:'dossier/prediction/family/horizon',violations:0,maxExpectedPerHorizon},
  rule:'Geen kandidaat wordt modelgewicht zonder nieuwe blinde out-of-sample test.'
},null,2));
console.log(`dossiers=${files.length} hypotheses=${hypotheses.length} integrity=OK`);
