import fs from 'node:fs/promises';
import {isValidIsin} from './isin-identity-core.mjs';
const [,,catalogPath,sourcePath,outputPath]=process.argv;
if(!catalogPath||!sourcePath||!outputPath)throw Error('USAGE: node block2-official-source-compare.mjs CATALOG.json OFFICIAL.json OUTPUT.json');
const catalog=JSON.parse(await fs.readFile(catalogPath,'utf8'));
const official=JSON.parse(await fs.readFile(sourcePath,'utf8'));
if(!Array.isArray(official.records)||!official.sourceUrl?.startsWith('https://')||!Number.isFinite(Date.parse(official.asOf||'')))throw Error('OFFICIAL_SOURCE_METADATA_REQUIRED');
if(official.coverage!=='COMPLETE_MARKET'&&official.coverage!=='PARTIAL_MARKET')throw Error('OFFICIAL_SOURCE_COVERAGE_REQUIRED');
if(!official.records.length)throw Error('EMPTY_OFFICIAL_SOURCE');
const rows=Array.isArray(catalog)?catalog:(catalog.shares||catalog.instruments);
if(!Array.isArray(rows))throw Error('INVALID_CATALOG');
const normalized=v=>String(v??'').trim().toUpperCase();
const registry=new Map();
const catalogSymbols=new Set();
for(const record of official.records){
 const symbol=normalized(record.symbol),isin=normalized(record.isin);
 if(!symbol||!isValidIsin(isin))throw Error('INVALID_OFFICIAL_ROW');
 if(registry.has(symbol))throw Error('DUPLICATE_OFFICIAL_SYMBOL');
 registry.set(symbol,{isin,recordId:record.recordId||null});
}
const results=rows.map((row,index)=>{
 const symbol=normalized(row.symbol||row.ticker);
 if(!symbol||catalogSymbols.has(symbol))throw Error('MISSING_OR_DUPLICATE_CATALOG_SYMBOL');
 catalogSymbols.add(symbol);
 const actual=normalized(row.isin);
 const match=registry.get(symbol);
 const status=!match?(official.coverage==='COMPLETE_MARKET'?'OFFICIAL_SOURCE_NOT_FOUND':'NOT_IN_PARTIAL_SOURCE'):!actual?'CATALOG_ISIN_MISSING':actual!==match.isin?'OFFICIAL_SOURCE_MISMATCH':'PRIMARY_SOURCE_MATCH';
 return {index,symbol,catalogIsin:actual||null,officialIsin:match?.isin||null,status,sourceRecordId:match?.recordId||null};
});
const summary=Object.fromEntries([...new Set(results.map(x=>x.status))].sort().map(status=>[status,results.filter(x=>x.status===status).length]));
const report={schema:1,sourceUrl:official.sourceUrl,asOf:official.asOf,coverage:official.coverage,sourceRecordCount:registry.size,catalogCount:rows.length,summary,results,certified:false,sourceAuthenticityVerified:false};
await fs.mkdir((await import('node:path')).dirname(outputPath),{recursive:true});
await fs.writeFile(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary));
if(summary.OFFICIAL_SOURCE_MISMATCH||summary.CATALOG_ISIN_MISSING||summary.OFFICIAL_SOURCE_NOT_FOUND)process.exitCode=1;
