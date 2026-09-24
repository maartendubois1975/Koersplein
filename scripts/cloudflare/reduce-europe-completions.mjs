import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.argv[2]||'research/output/completion-artifacts';
const planPath='data/world-fill-plan.json',registryPath='data/market-source-registry.json';
const plan=JSON.parse(await fs.readFile(planPath,'utf8'));
const registry=JSON.parse(await fs.readFile(registryPath,'utf8'));registry.markets||={};
const proven=new Map(),blocked=new Map(),artifactSources=new Map();

async function walk(dir,name){let out=[];try{for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p,name));else if(e.name===name)out.push(p)}}catch{}return out}

// Source discovery happens inside isolated market jobs. Reduce that evidence into the
// canonical registry here, so the single writer—not parallel jobs—owns persistent state.
for(const file of await walk(root,'market-source-registry.json')){
  try{const r=JSON.parse(await fs.readFile(file,'utf8'));for(const [mic,s] of Object.entries(r.markets||{})){if(!s?.catalogFingerprint)continue;const old=artifactSources.get(mic);if(!old||String(s.lastAuditAt||'')>=String(old.lastAuditAt||''))artifactSources.set(mic,s)}}catch{}
}
for(const [mic,s] of artifactSources){registry.markets[mic]=s;if(s.status==='BLOCKED')blocked.set(mic,{reason:s.blockedReason||'SOURCE_PREFLIGHT_GATE',fingerprint:s.catalogFingerprint});}

for(const file of await walk(root,'market-handoff-signal.json')){
  try{
    const s=JSON.parse(await fs.readFile(file,'utf8')),mic=s.market||s.currentMarket||s.mic||s.current?.mic,v=s.validation||s.result||s.current||s;
    if(!mic||v.ready!==true)continue;
    if(!(Number(v.catalog)>0&&Number(v.checked)===Number(v.catalog)&&Number(v.complete)===Number(v.catalog)&&Number(v.missing)===0&&Number(v.invalid)===0))continue;
    const fingerprint=v.catalogFingerprint||s.catalogFingerprint||null,source=registry.markets?.[mic];
    if(!fingerprint||source?.status!=='APPROVED'||source.catalogFingerprint!==fingerprint)continue;
    proven.set(mic,{fingerprint,completedAt:s.emittedAt||new Date().toISOString()});
  }catch{}
}

let changed=0;
for(const m of plan.markets){
  const p=proven.get(m.mic);
  if(p){if(m.state!=='COMPLETE'||m.catalogFingerprint!==p.fingerprint){m.state='COMPLETE';m.completedAt=p.completedAt;m.catalogFingerprint=p.fingerprint;delete m.note;delete m.blockedReason;delete m.blockedAt;changed++;}continue;}
  const b=blocked.get(m.mic);
  if(b&&m.state!=='COMPLETE'&&(m.state!=='BLOCKED'||m.blockedReason!==b.reason||m.catalogFingerprint!==b.fingerprint)){m.state='BLOCKED';m.blockedReason=b.reason;m.blockedAt=new Date().toISOString();m.catalogFingerprint=b.fingerprint;m.note='Quarantined by canonical single writer after proven source preflight failure.';changed++;}
}
await fs.writeFile(planPath,JSON.stringify(plan,null,2)+'\n');
await fs.writeFile(registryPath,JSON.stringify(registry,null,2)+'\n');
console.log(JSON.stringify({changed,proven:[...proven.keys()],blocked:[...blocked.keys()],sourceEvidence:[...artifactSources.keys()]},null,2));
