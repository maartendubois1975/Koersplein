import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
const scopes=[['priority',102],['remaining',18]];
const all=[];
for(const [scope,expected] of scopes){
 const r=spawnSync(process.execPath,['scripts/cloudflare/europe-priority-source-probe.mjs'],{env:{...process.env,EUROPE_PROBE_SCOPE:scope},encoding:'utf8',timeout:45*60*1000,maxBuffer:16*1024*1024});
 if(r.stdout)process.stdout.write(r.stdout);
 if(r.stderr)process.stderr.write(r.stderr);
 if(r.status!==0)throw Error('Source probe failed for '+scope+' (exit '+r.status+')');
 const report=JSON.parse(await fs.readFile('research/output/europe-'+scope+'-'+expected+'-source-probe.json','utf8'));
 if(report.total!==expected||report.results.length!==expected)throw Error('Incomplete scope '+scope);
 all.push(...report.results);
}
const unique=new Set(all.map(r=>r.mic+'|'+r.isin+'|'+r.symbol));
if(all.length!==120||unique.size!==120)throw Error('Expected exactly 120 distinct exchange-specific listings');
const classification={
 WRONG_EXCHANGE_MATCH:'VERIFY_EXCHANGE_IDENTITY_BEFORE_DATA_IMPORT',
 NO_OFFICIAL_PUBLIC_TRADES:'VERIFY_LISTING_AND_LICENSED_EXCHANGE_ARCHIVE',
 NO_PUBLIC_PROVIDER_BARS:'VERIFY_OFFICIAL_ARCHIVE_OR_NONTRADING_STATUS',
 SOURCE_TIMEOUT:'RETRY_PROVIDER_AFTER_NETWORK_CHECK',
 SOURCE_UNRESOLVED:'MANUAL_SOURCE_INVESTIGATION'
};
const records=all.map(r=>({...r,requiredAction:classification[r.diagnostic]||'VERIFY_SOURCE_AND_BARS',productionImportAllowed:false}));
const byDiagnostic=Object.fromEntries([...new Set(records.map(r=>r.diagnostic||r.status))].map(k=>[k,records.filter(r=>(r.diagnostic||r.status)===k).length]));
const byMarket=Object.fromEntries([...new Set(records.map(r=>r.mic))].map(k=>[k,records.filter(r=>r.mic===k).length]));
const result={generatedAt:new Date().toISOString(),scope:'EUROPE_120_UNIFIED_RESEARCH',mode:'READ_ONLY_NO_PRODUCTION_WRITES',total:120,byDiagnostic,byMarket,verifiedAndImportable:0,records};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/europe-unified-120-remediation.json',JSON.stringify(result,null,2)+'\n');
const lines=['# Europa: 120 ontbrekende reeksen','', 'Dit rapport is uitsluitend onderzoek; geen brondata zijn gevalideerd voor import.','', '| Diagnose | Aantal |','|---|---:|',...Object.entries(byDiagnostic).map(([k,v])=>'| '+k+' | '+v+' |'),'','Alle 120 hebben een beursgebonden identiteit. Import vereist onafhankelijke bronverificatie en goedgekeurde koersbalken.'];
await fs.writeFile('research/output/europe-unified-120-remediation.md',lines.join('\n')+'\n');
console.log('EUROPE_UNIFIED_REMEDIATION_SUMMARY',JSON.stringify({total:120,byDiagnostic,byMarket,verifiedAndImportable:0}));
