// TXSE research-only catalog: exchange symbols plus independent Nasdaq Trader directory crosscheck.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseUSDirectory} from './usa-directory-parse.mjs';
import {parseTXSESymbols,buildTXSECatalog} from './usa-txse-catalog.mjs';
const source='https://download.web.txse.com/public_symbols.txt';
const otherlistedSource='https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt';
async function get(url){
 const r=await fetch(url,{headers:{'User-Agent':'Koersplein-USA-research/1.0'},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('OFFICIAL_SOURCE_HTTP_'+r.status+':'+url);
 return r.text();
}
const [raw,otherRaw]=await Promise.all([get(source),get(otherlistedSource)]);
const rows=parseTXSESymbols(raw);
if(rows.length<1000)throw Error('TXSE_UNEXPECTEDLY_SMALL_TRADABLE_REGISTER');
const other=parseUSDirectory(otherRaw,['ACT Symbol','Security Name','Exchange','ETF','Test Issue']);
const meta={source,sourceSha256:createHash('sha256').update(raw).digest('hex'),observedAt:new Date().toISOString(),
 otherlistedSource,otherlistedTimestamp:other.sourceTimestamp,otherlistedSha256:other.sha256};
const result=buildTXSECatalog(rows,other.rows,meta);
if(!result.summary.txseListedFlagCount)throw Error('TXSE_NO_LISTED_FLAGS_REQUIRES_REVIEW');
const dir='research/output/usa/TXSE';
await fs.mkdir(dir,{recursive:true});
await fs.writeFile(dir+'/universe.json',JSON.stringify({meta,securities:result.securities},null,2));
await fs.writeFile(dir+'/coverage.json',JSON.stringify(result.summary,null,2));
console.log(JSON.stringify(result.summary,null,2));
