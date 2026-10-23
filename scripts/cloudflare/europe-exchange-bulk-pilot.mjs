// Independent EODHD bulk adapter: read-only coverage + price comparison.
import fs from 'node:fs/promises';
import {normalizeBulkBars,reconcileBulkWithCatalog} from './exchange-bulk-reconcile.mjs';
const token=process.env.EODHD_API_TOKEN;
if(!token)throw Error('EODHD_API_TOKEN required; no production writes attempted');
const date=process.env.BULK_PILOT_DATE;
if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw Error('BULK_PILOT_DATE must be YYYY-MM-DD');
const exchanges=[{exchange:'PA',mic:'XPAR'},{exchange:'XETRA',mic:'XETR'},{exchange:'BR',mic:'XBRU'}];
const officialParis=JSON.parse(await fs.readFile('data/euronext-paris.json','utf8')).shares;
async function get(path){
 const url=new URL('https://eodhd.com/api/'+path);
 url.searchParams.set('api_token',token);
 url.searchParams.set('fmt','json');
 if(path.startsWith('eod-bulk-last-day/'))url.searchParams.set('date',date);
 const response=await fetch(url,{signal:AbortSignal.timeout(90000)});
 if(!response.ok)throw Error(path+' HTTP '+response.status);
 const json=await response.json();
 if(!Array.isArray(json))throw Error(path+' did not return an array');
 return json;
}
const reports=[];
for(const {exchange,mic} of exchanges){
 const [listings,raw]=await Promise.all([get('exchange-symbol-list/'+exchange),get('eod-bulk-last-day/'+exchange)]);
 const normalized=normalizeBulkBars(raw,{date});
 const catalog=exchange==='PA'?officialParis.filter(x=>['XPAR','ALXP','XMLI'].includes(x.mic)):[];
 const coverageComparable=exchange==='PA';
 const comparison=reconcileBulkWithCatalog({catalog,providerListings:listings,bulkBars:normalized.bars});
 const report={exchange,mic,date,providerListings:listings.length,rawBars:raw.length,validBars:normalized.bars.length,invalidRows:normalized.errors.slice(0,50),invalidRowCount:normalized.errors.length,officialCatalogSize:coverageComparable?catalog.length:null,coverageComparable,matched:coverageComparable?comparison.matched.length:null,missing:coverageComparable?comparison.missing.length:null,ambiguous:coverageComparable?comparison.ambiguous.length:null,missingExamples:comparison.missing.slice(0,30)};
 reports.push(report);
 console.log('EXCHANGE_BULK_PILOT',JSON.stringify({...report,invalidRows:undefined,missingExamples:undefined}));
}
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/europe-exchange-bulk-pilot.json',JSON.stringify({generatedAt:new Date().toISOString(),readOnly:true,date,reports},null,2)+'\n');
