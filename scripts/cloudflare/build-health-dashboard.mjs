import fs from 'node:fs/promises';
const read=async(p,fallback=null)=>{try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return fallback}};
const plan=await read('data/world-fill-plan.json',{markets:[]}),registry=await read('data/market-source-registry.json',{markets:{}});
const generatedAt=new Date().toISOString(),markets=[];
for(const m of plan.markets||[]){
  const r=registry.markets?.[m.mic]||{},cat=await read(`data/euronext-${m.code}.json`);
  const localFingerprint=cat?.fingerprint||null;
  const canonicalFingerprint=m.catalogFingerprint||r.catalogFingerprint||null;
  const fingerprint=localFingerprint||canonicalFingerprint;
  const sourceFingerprint=r.catalogFingerprint||m.catalogFingerprint||null;
  let health='WAITING',reason=null;
  if(m.state==='COMPLETE')health='COMPLETE';
  else if(m.state==='BLOCKED'){health='BLOCKED';reason=m.blockedReason||m.note||r.blockedReason||'UNSPECIFIED';}
  else if(!cat)health='CATALOG_PENDING';
  else if(r.status!=='APPROVED'){health='SOURCE_PENDING';reason=r.blockedReason||'SOURCE_NOT_APPROVED';}
  else if(sourceFingerprint&&localFingerprint&&localFingerprint!==sourceFingerprint){health='BLOCKED';reason='CATALOG_FINGERPRINT_MISMATCH';}
  else health='READY';
  markets.push({mic:m.mic,name:m.name,state:m.state,health,reason,catalog:{present:!!cat,count:cat?.shares?.length||r.discovery?.testedFullCatalog||0,fingerprint,retrievedAt:cat?.retrievedAt||null,source:cat?.source||r.catalogSource||null},sources:{status:r.status||'UNTESTED',tested:r.discovery?.sourceCountTested||r.historySources?.length||0,fullCatalog:r.discovery?.testedFullCatalog||0,coverageRatio:r.discovery?.coverageRatio??null,crossCheckRatio:r.discovery?.crossCheckRatio??null},completedAt:m.completedAt||null});
}
const summary={complete:markets.filter(x=>x.health==='COMPLETE').length,blocked:markets.filter(x=>x.health==='BLOCKED').length,ready:markets.filter(x=>x.health==='READY').length,pending:markets.filter(x=>!['COMPLETE','BLOCKED','READY'].includes(x.health)).length,total:markets.length};
const previous=await read('data/europe-health.json');
const stable={version:1,canonicalState:'data/world-fill-plan.json',sourceRegistry:'data/market-source-registry.json',summary,markets};
const previousStable=previous?{version:previous.version,canonicalState:previous.canonicalState,sourceRegistry:previous.sourceRegistry,summary:previous.summary,markets:previous.markets}:null;
const unchanged=previousStable&&JSON.stringify(previousStable)===JSON.stringify(stable);
const out={...stable,generatedAt:unchanged?previous.generatedAt:generatedAt};
await fs.writeFile('data/europe-health.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(summary));
