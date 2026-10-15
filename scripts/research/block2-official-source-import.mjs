import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isValidIsin} from './isin-identity-core.mjs';
const [,,inputPath,metadataPath,outputPath]=process.argv;
if(!inputPath||!metadataPath||!outputPath)throw Error('USAGE: node block2-official-source-import.mjs SOURCE.csv METADATA.json OUTPUT.json');
const bytes=await fs.readFile(inputPath);
const meta=JSON.parse(await fs.readFile(metadataPath,'utf8'));
if(!meta.sourceUrl?.startsWith('https://')||!Number.isFinite(Date.parse(meta.asOf||''))||meta.coverage!=='PARTIAL_MARKET')throw Error('PRIMARY_SOURCE_METADATA_REQUIRED_PARTIAL_ONLY');
if(meta.expectedSha256!==createHash('sha256').update(bytes).digest('hex'))throw Error('SOURCE_SHA256_MISMATCH');
const raw=bytes.toString('utf8').replace(/^\uFEFF/,'').trim();
const lines=raw.split(/\r?\n/);
const header=lines.shift().split(',').map(s=>s.trim().toLowerCase());
if(header.join(',')!=='symbol,isin,recordid')throw Error('EXPECTED_CSV_HEADER_symbol_isin_recordId');
const seen=new Set(),records=[];
for(const line of lines){
 if(!line.trim())continue;
 const parts=line.split(',');
 if(parts.length!==3)throw Error('INVALID_CSV_ROW');
 const [symbol,isin,recordId]=parts.map(s=>s.trim().toUpperCase());
 if(!symbol||!recordId||!isValidIsin(isin)||seen.has(symbol))throw Error('INVALID_OR_DUPLICATE_SOURCE_ROW');
 seen.add(symbol);records.push({symbol,isin,recordId});
}
if(!records.length)throw Error('EMPTY_OFFICIAL_SOURCE');
const result={sourceUrl:meta.sourceUrl,asOf:meta.asOf,coverage:'PARTIAL_MARKET',inputSha256:meta.expectedSha256,sourceAuthenticityVerified:false,records};
await fs.mkdir((await import('node:path')).dirname(outputPath),{recursive:true});
await fs.writeFile(outputPath,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({records:records.length,coverage:result.coverage,sourceAuthenticityVerified:false}));
