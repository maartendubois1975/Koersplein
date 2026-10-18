import fs from 'node:fs/promises';
import {storageIdentityResolver} from './storage-identity.mjs';
const baseUrl=String(process.env.KOERSPLEIN_API_URL||'').replace(/\/$/,'');
if(!baseUrl)throw Error('KOERSPLEIN_API_URL missing');
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const response=await fetch(baseUrl+'/api/history/manifest.json',{signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error('Public manifest HTTP '+response.status);
const manifest=(await response.json()).instruments||{};
const resolve=storageIdentityResolver(Object.entries(manifest).map(([isin,row])=>({...row,isin})));
let expected=0;
const rows=[];
for(const market of plan.markets.filter(m=>m.state==='COMPLETE')){
  const data=JSON.parse(await fs.readFile('data/euronext-'+market.code+'.json','utf8'));

  for(const share of data.shares||data.instruments||[]){
    expected++;
    if(!share.isin)continue;
    const storedKey=resolve({...share,mic:share.mic||market.mic});
    const entry=storedKey&&manifest[storedKey];
    if(entry?.lastDate&&Number(entry.recordCount||entry.records||0)>0)continue;
    rows.push({
      mic:market.mic,market:market.name,isin:share.isin,
      symbol:share.symbol||share.ticker||null,
      company:share.company||share.name||null,
      storageKey:storedKey||null,
      reason:storedKey?'NO_STORED_HISTORY':'NO_MATCHING_PUBLIC_MANIFEST_IDENTITY',
      researchStatus:'PENDING_MANUAL_SOURCE_VERIFICATION',
      verifiedSource:null,verifiedBars:0,
      publicationApproved:false
    });
  }
}
rows.sort((a,b)=>a.mic.localeCompare(b.mic)||a.isin.localeCompare(b.isin));
const byMarket=Object.fromEntries([...new Set(rows.map(r=>r.mic))].map(mic=>[mic,rows.filter(r=>r.mic===mic).length]));
const report={generatedAt:new Date().toISOString(),mode:'READ_ONLY_NO_FACTORY_MUTATIONS',expected,count:rows.length,byMarket,rows};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/europe-missing-history-inventory.json',JSON.stringify(report,null,2)+'\n');
await fs.writeFile('research/output/europe-missing-history-inventory.csv',
  ['mic,market,isin,symbol,company,storageKey,reason,researchStatus,verifiedSource,verifiedBars,publicationApproved',...rows.map(r=>[r.mic,r.market,r.isin,r.symbol,r.company,r.storageKey,r.reason,r.researchStatus,r.verifiedSource,r.verifiedBars,r.publicationApproved].map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(','))].join('\n')+'\n');
console.log('EUROPE_MISSING_INVENTORY',JSON.stringify({count:rows.length,byMarket}));
for(const row of rows)console.log('EUROPE_MISSING_ITEM',JSON.stringify(row));
