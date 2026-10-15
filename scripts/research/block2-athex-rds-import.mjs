import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isValidIsin} from './isin-identity-core.mjs';
const [,,sourcePath,metadataPath,outputPath]=process.argv;
if(!sourcePath||!metadataPath||!outputPath)throw Error('USAGE: node block2-athex-rds-import.mjs InstrumentSeries-YYYYMMDD-G-vN.csv metadata.json output.json');
const bytes=await fs.readFile(sourcePath),meta=JSON.parse(await fs.readFile(metadataPath,'utf8'));
const hash=createHash('sha256').update(bytes).digest('hex');
if(hash!==meta.expectedSha256)throw Error('SOURCE_HASH_MISMATCH');
if(!meta.sourceUrl?.startsWith('https://')||!Number.isFinite(Date.parse(meta.asOf||'')))throw Error('SOURCE_PROVENANCE_REQUIRED');
if(meta.fieldPositions?.symbol!==1||meta.fieldPositions?.isin!==19||meta.fieldPositions?.instrumentType!==9||meta.fieldPositions?.rightsFlag!==12)throw Error('EXPLICIT_VERIFIED_FIELD_MAPPING_REQUIRED');
if(meta.fieldMappingVerified!==true||!meta.fieldMappingSourceUrl?.startsWith('https://'))throw Error('OFFICIAL_FIELD_MAPPING_EVIDENCE_REQUIRED');
if(meta.fieldMappingSourceUrl.includes('example.org'))throw Error('PLACEHOLDER_MAPPING_SOURCE_NOT_ALLOWED');
if(!meta.sourceRetrievedAt||!Number.isFinite(Date.parse(meta.sourceRetrievedAt))||!meta.retrievalMethod||!meta.retrievedBy)throw Error('SOURCE_RETRIEVAL_AUDIT_REQUIRED');
const filename=path.basename(sourcePath);
const match=/^InstrumentSeries-(\d{8})-G-v\d+\.csv$/i.exec(filename);
if(!match||meta.asOf.slice(0,10).replaceAll('-','')!==match[1])throw Error('ATHEX_PRODUCTION_FILENAME_DATE_REQUIRED');
const raw=new TextDecoder('iso-8859-7',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');
const lines=raw.split(/\r?\n/).filter(x=>x.trim()),records=[],rejected=[],seen=new Set();
for(let i=0;i<lines.length;i++){
 const cols=lines[i].split(';');
 if(cols.at(-1)==='')cols.pop();
 if(cols.length<27)throw Error('SHORT_RDS_ROW_'+(i+1));
 const field=n=>(cols[n-1]||'').trim();
 const symbol=field(1).toUpperCase(),isin=field(19).toUpperCase(),type=field(9).toUpperCase(),right=field(12).toUpperCase();
 const reason=field(8)!=='5'?'NOT_EQUITY_PRODUCT':type!=='CS'?'NOT_COMMON_STOCK':right!=='N'?(right==='R'?'SUBSCRIPTION_RIGHT':'UNKNOWN_RIGHT_FLAG'):!isValidIsin(isin)?'INVALID_ISIN':!symbol?'MISSING_SYMBOL':seen.has(symbol)?'DUPLICATE_SYMBOL':null;
 if(reason){if(reason==='DUPLICATE_SYMBOL')throw Error('DUPLICATE_RDS_SYMBOL_'+symbol);rejected.push({line:i+1,symbol,reason});continue;}
 seen.add(symbol);
 records.push({symbol,isin,recordId:filename+':'+(i+1),instrumentType:'COMMON_STOCK',exchange:field(3),venue:field(4),market:field(6),isTraded:field(26),status:field(27),englishName:field(24)});
}
if(rejected.some(x=>x.reason==='UNKNOWN_RIGHT_FLAG'))throw Error('UNKNOWN_RIGHT_FLAG_IN_SOURCE');
if(!records.length)throw Error('NO_VALID_COMMON_STOCKS');
if(records.length+rejected.length!==lines.length)throw Error('SOURCE_ROW_ACCOUNTING_MISMATCH');
const output={schema:1,sourceUrl:meta.sourceUrl,asOf:meta.asOf,coverage:'PARTIAL_MARKET',inputSha256:hash,sourceRetrievedAt:meta.sourceRetrievedAt,retrievalMethod:meta.retrievalMethod,retrievedBy:meta.retrievedBy,sourceAuthenticityVerified:false,sourceFormat:'ATHEX_RDS_INSTRUMENT_SERIES',records,rejected,sourceRows:lines.length};
await fs.mkdir(path.dirname(outputPath),{recursive:true});
await fs.writeFile(outputPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({rows:lines.length,commonStocks:records.length,rejected:rejected.length,authenticityVerified:false}));
