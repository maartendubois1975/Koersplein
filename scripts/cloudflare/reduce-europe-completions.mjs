import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.argv[2]||'research/output/completion-artifacts';
const planPath='data/world-fill-plan.json';
const plan=JSON.parse(await fs.readFile(planPath,'utf8'));
const proven=new Map();

async function walk(dir){
  let out=[];
  try{
    for(const e of await fs.readdir(dir,{withFileTypes:true})){
      const p=path.join(dir,e.name);
      if(e.isDirectory()) out.push(...await walk(p));
      else if(e.name==='market-handoff-signal.json') out.push(p);
    }
  }catch{}
  return out;
}

for(const file of await walk(root)){
  try{
    const s=JSON.parse(await fs.readFile(file,'utf8'));
    const mic=s.market||s.currentMarket||s.mic;
    const v=s.validation||s.result||s;
    if(!mic||v.ready!==true) continue;
    if(!(Number(v.catalog)>0&&Number(v.checked)===Number(v.catalog)&&Number(v.complete)===Number(v.catalog)&&Number(v.missing)===0&&Number(v.invalid)===0)) continue;
    proven.set(mic,{fingerprint:v.catalogFingerprint||s.catalogFingerprint||null,completedAt:s.emittedAt||new Date().toISOString()});
  }catch{}
}

let changed=0;
for(const m of plan.markets){
  const p=proven.get(m.mic); if(!p) continue;
  if(m.state!=='COMPLETE'||(p.fingerprint&&m.catalogFingerprint!==p.fingerprint)){
    m.state='COMPLETE'; m.completedAt=p.completedAt; if(p.fingerprint)m.catalogFingerprint=p.fingerprint; delete m.note; changed++;
  }
}
await fs.writeFile(planPath,JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({changed,proven:[...proven.keys()]},null,2));
