// Reconcile independently acquired exchange snapshots against the current catalogue.
// Input is a locally supplied JSON file: {mic,sourceUrl,retrievedAt,records:[{symbol,isin,securityType,...}]}.
// This module does not claim that a URL has been fetched or independently verified.
import fs from 'node:fs/promises';
import {isValidIsin} from './isin-identity-core.mjs';
const input=process.argv[2];
if(!input)throw Error('Usage: node block1-v2-source-reconciliation.mjs <official-snapshot.json>');
const snapshot=JSON.parse(await fs.readFile(input,'utf8'));
if(!snapshot.mic||!/^https:\/\//.test(snapshot.sourceUrl||'')||!snapshot.retrievedAt||!Array.isArray(snapshot.records))throw Error('Invalid snapshot metadata');
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const market=plan.markets.find(m=>m.mic===snapshot.mic);
if(!market)throw Error('Unknown market MIC');
const raw=JSON.parse(await fs.readFile('data/euronext-'+market.code+'.json','utf8'));
const items=Array.isArray(raw)?raw:(raw.shares||raw.instruments||[]);
const key=x=>String(x.providerSymbol||x.symbol||x.ticker||'').trim();
const current=new Map(),official=new Map(),issues=[];
for(const item of items){const k=key(item);if(current.has(k))issues.push({symbol:k,reason:'DUPLICATE_CURRENT_SYMBOL'});else current.set(k,item)}
for(const item of snapshot.records){
 const k=key(item);
 if(!k||official.has(k)){issues.push({symbol:k,reason:'MISSING_OR_DUPLICATE_OFFICIAL_SYMBOL'});continue;}
 if(!item.isin||!isValidIsin(item.isin)){issues.push({symbol:k,reason:'INVALID_OFFICIAL_ISIN'});continue;}
 official.set(k,item);
}
const matched=[],missingFromCatalog=[],missingFromSnapshot=[],conflicts=[];
for(const [symbol,item] of official){
 const old=current.get(symbol);
 if(!old){missingFromCatalog.push({symbol,isin:item.isin});continue;}
 if(old.isin&&isValidIsin(old.isin)&&old.isin!==item.isin)conflicts.push({symbol,oldIsin:old.isin,officialIsin:item.isin});
 else matched.push({symbol,isin:item.isin,securityType:item.securityType||null,sourceUrl:snapshot.sourceUrl});
}
for(const [symbol,item] of current)if(!official.has(symbol))missingFromSnapshot.push({symbol,isin:item.isin||null});
const report={mic:market.mic,sourceUrl:snapshot.sourceUrl,retrievedAt:snapshot.retrievedAt,sourceSnapshotIndependentlyVerified:false,counts:{current:items.length,official:snapshot.records.length,matched:matched.length,missingFromCatalog:missingFromCatalog.length,missingFromSnapshot:missingFromSnapshot.length,conflicts:conflicts.length,issues:issues.length},matched,missingFromCatalog,missingFromSnapshot,conflicts,issues};
await fs.mkdir('research/output/block1-reconciliation',{recursive:true});
await fs.writeFile('research/output/block1-reconciliation/'+market.code+'.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({mic:market.mic,counts:report.counts}));
if(conflicts.length||issues.length||missingFromCatalog.length)process.exitCode=1;
