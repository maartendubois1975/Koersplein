import fs from 'node:fs/promises';
const raw=await fs.readFile('research/europe-missing-120-dossier.csv','utf8');
const rows=raw.trim().split('\n').slice(1).map(line=>{
 const c=[...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(m=>m[1].replaceAll('""','"'));
 return {mic:c[0],market:c[1],isin:c[2],symbol:c[3],company:c[4]};
});
if(rows.length!==120)throw Error('Expected 120 missing listings; got '+rows.length);
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const markets=[];
for(const m of plan.markets.filter(x=>x.state==='COMPLETE')){
 const cat=JSON.parse(await fs.readFile('data/euronext-'+m.code+'.json','utf8'));
 markets.push({...m,shares:cat.shares||cat.instruments||[]});
}
const catalog=new Map(markets.flatMap(m=>m.shares.map(s=>[m.mic+'|'+s.symbol+'|'+s.isin,{...s,mic:m.mic}])));
const byIsin=new Map();
for(const m of markets)for(const s of m.shares){
 if(!s.isin)continue;
 const list=byIsin.get(s.isin)||[];list.push({mic:m.mic,symbol:s.symbol});byIsin.set(s.isin,list);
}
const report=rows.map(r=>{
 const matches=byIsin.get(r.isin)||[];
 const exact=catalog.has(r.mic+'|'+r.symbol+'|'+r.isin);
 const otherVenues=matches.filter(x=>x.mic!==r.mic);
 return {...r,catalogIdentityPresent:exact,otherVenues,otherVenueCount:otherVenues.length,
  identityRoute:!exact?'CATALOG_IDENTITY_MISMATCH':otherVenues.length?'VERIFY_PRIMARY_VENUE_AND_TRADING':'VERIFY_TRADING_AND_SOURCE',
  approvedForImport:false};
});
const identities=new Set(report.map(r=>r.mic+'|'+r.symbol+'|'+r.isin));
if(identities.size!==120)throw Error('Duplicate missing-listing identities');
const summary={total:report.length,missingFromLocalCatalog:report.filter(r=>!r.catalogIdentityPresent).length,
 crossVenueIsin:report.filter(r=>r.otherVenueCount>0).length,
 byRoute:Object.fromEntries([...new Set(report.map(r=>r.identityRoute))].map(k=>[k,report.filter(r=>r.identityRoute===k).length]))};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/europe-120-identity-triage.json',JSON.stringify({generatedAt:new Date().toISOString(),mode:'READ_ONLY',summary,records:report},null,2)+'\n');
console.log('EUROPE_120_IDENTITY_TRIAGE',JSON.stringify(summary));
