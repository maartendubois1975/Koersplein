import fs from 'node:fs/promises';
import {isValidIsin} from './isin-identity-core.mjs';
const [,,catalogPath,sourcePath,outputPath]=process.argv;
if(!catalogPath||!sourcePath||!outputPath)throw Error('USAGE: node block2-official-source-compare.mjs CATALOG.json OFFICIAL.json OUTPUT.json');
const catalog=JSON.parse(await fs.readFile(catalogPath,'utf8'));
const official=JSON.parse(await fs.readFile(sourcePath,'utf8'));
if(!Array.isArray(official.records)||!official.sourceUrl?.startsWith('https://')||!Number.isFinite(Date.parse(official.asOf||'')))throw Error('OFFICIAL_SOURCE_METADATA_REQUIRED');
const rows=Array.isArray(catalog)?catalog:(catalog.shares||catalog.instruments);
if(!Array.isArray(rows))throw Error('INVALID_CATALOG');
const normalized=v=>String(v??'').trim().toUpperCase();
const registry=new Map();
for(const record of official.records){
 const symbol=normalized(record.symbol),isin=normalized(record.isin);
 if(!symbol||!isValidIsin(isin))throw Error('INVALID_OFFICIAL_ROW');
 if(registry.has(symbol))throw Error('DUPLICATE_OFFICIAL_SYMBOL');
 registry.set(symbol,{isin,recordId:record.recordId||null});
}
const results=rows.map((row,index)=>{
 const symbol=normalized(row.symbol||row.ticker);
 const actual=normalized(row.isin);
 const match=registry.get(symbol);
 const status=!match?'OFFICIAL_SOURCE_NOT_FOUND':!actual?'CATALOG_ISIN_MISSING':actual!==match.isin?'OFFICIAL_SOURCE_MISMATCH':'PRIMARY_SOURCE_MATCH';
 return {index,symbol,catalogIsin:actual||null,officialIsin:match?.isin||null,status,sourceRecordId:match?.recordId||null};
});
const summary=Object.fromEntries([...new Set(results.map(x=>x.status))].sort().map(status=>[status,results.filter(x=>x.status===status).length]));
const report={schema:1,sourceUrl:official.sourceUrl,asOf:official.asOf,sourceRecordCount:registry.size,catalogCount:rows.length,summary,results,certified:false,sourceAuthenticityVerified:false};
await fs.mkdir((await import('node:path')).dirname(outputPath),{recursive:true});
await fs.writeFile(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary));
if(summary.OFFICIAL_SOURCE_MISMATCH||summary.CATALOG_ISIN_MISSING)process.exitCode=1;
