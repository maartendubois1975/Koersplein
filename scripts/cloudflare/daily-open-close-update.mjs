import fs from 'node:fs/promises';
import {FactoryApiClient} from './client.mjs';
import {createDefaultProviderRegistry} from '../history/provider-registry.mjs';
import {partitionBars} from './history-format.mjs';
const client=new FactoryApiClient(),providers=createDefaultProviderRegistry();
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8')),sourceRegistry=JSON.parse(await fs.readFile('data/market-source-registry.json','utf8'));
const today=new Date().toISOString().slice(0,10),results=[];
const shardCount=Number(process.env.EUROPE_SHARD_COUNT||1),shardIndex=Number(process.env.EUROPE_SHARD_INDEX||0);
if(!Number.isInteger(shardCount)||shardCount<1||!Number.isInteger(shardIndex)||shardIndex<0||shardIndex>=shardCount)throw Error('Invalid Europe shard configuration');
const targetMarkets=plan.markets.filter(x=>x.state==='COMPLETE').filter((_,index)=>index%shardCount===shardIndex);
const reportPath=`research/output/daily-open-close-update-${shardIndex}.json`;
await fs.mkdir('research/output',{recursive:true});
async function checkpoint(){await fs.writeFile(reportPath,JSON.stringify({generatedAt:new Date().toISOString(),shardIndex,shardCount,mode:'APPEND_ONLY_STALE_AND_MISSING_COMPLETE_MARKETS',markets:results},null,2));}
// Verify factory credentials once before processing thousands of instruments.
try { await client.catalog(); } catch(error) {
 console.error('FACTORY_AUTH_PREFLIGHT_FAILED: productie-updates vereisen geldige Cloudflare factory-autorisatie: '+error.message);
 process.exit(3);
}
const manifestResponse=await fetch(client.baseUrl+'/api/history/manifest.json',{signal:AbortSignal.timeout(30000)});
if(!manifestResponse.ok)throw Error('Public manifest HTTP '+manifestResponse.status);
const manifest=(await manifestResponse.json()).instruments||{};
function failureCategory(message){
 const m=String(message||'');
 if(/429|rate.limit|too many requests/i.test(m))return 'RATE_LIMIT';
 if(/timeout|timed out|AbortError|fetch failed|ECONN|ETIMEDOUT/i.test(m))return 'NETWORK_TIMEOUT';
 if(/401|403|unauthorized|forbidden/i.test(m))return 'AUTH_OR_ACCESS';
 if(/404|not found|no data|no bars|empty/i.test(m))return 'SOURCE_NO_HISTORY';
 if(/422|invalid symbol|invalid ticker|symbol not/i.test(m))return 'SYMBOL_MAPPING';
 return 'PROVIDER_OTHER';
}
const freshnessCutoff=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
for(const market of targetMarkets){
 const source=sourceRegistry.markets?.[market.mic];if(!source||source.status!=='APPROVED')throw Error(`${market.mic}: COMPLETE zonder APPROVED bronroute`);
 const primary=source.historySources?.find(x=>x.role==='PRIMARY')?.provider;if(!primary)throw Error(`${market.mic}: geen PRIMARY bronroute`);
 if(!providers.get(primary))throw Error(`${market.mic}: onbekende PRIMARY provider ${primary}; bronregister corrigeren`);
 const catalog=JSON.parse(await fs.readFile(`data/euronext-${market.code}.json`,'utf8')),shares=catalog.shares||catalog.instruments||[];
 const unavailable=new Set((market.dataUnavailable||[]).map(x=>x.isin));let advanced=0,current=0,skipped=0,missing=0,failed=[];
 for(const s of shares){
  if(unavailable.has(s.isin)){skipped++;continue}
  try{
   const beforeDate=manifest[s.isin]?.lastDate||null;
   if(beforeDate && beforeDate>=freshnessCutoff){current++;continue;}
   const instrument={...s,ticker:s.ticker||s.symbol,symbol:s.symbol||s.ticker,mic:s.mic||market.mic,market:s.mic||market.mic,currency:s.currency||market.currency,countryCode:market.country};
   const {provider,result}=await providers.fetchDaily(instrument,{startDate:beforeDate||new Date(Date.now()-365*86400000).toISOString().slice(0,10),endDate:today},primary,{strictPreferred:false});
   const bars=(result.bars||[]).filter(b=>b.date&&Number(b.open)>0&&Number(b.close)>0&&(!beforeDate||b.date>beforeDate));
   for(const [period,part] of partitionBars(bars))await client.putPartition(s.isin,period,{bars:part,provider:provider.id});
   if(bars.length)await client.completeHistory(s.isin,{provider:provider.id});
   const afterDate=bars.at(-1)?.date||beforeDate;
   if(!afterDate)missing++;else if(!beforeDate||afterDate>beforeDate)advanced++;else current++;
  }catch(e){failed.push({isin:s.isin,symbol:s.symbol||s.ticker,category:failureCategory(e.message),error:e.message})}
 }
 results.push({mic:market.mic,catalog:shares.length,advanced,current,missing,skippedDataUnavailable:skipped,failed});
 await checkpoint();
 const failureCategories=failed.reduce((counts,item)=>(counts[item.category]=(counts[item.category]||0)+1,counts),{});
 console.log('EUROPE_MARKET_DONE',JSON.stringify({mic:market.mic,advanced,current,missing,skipped,failed:failed.length,failureCategories,examples:failed.slice(0,3)}));
}
await checkpoint();console.log(JSON.stringify(results.map(x=>({...x,failed:x.failed.length})),null,2));if(results.some(x=>x.failed.length||x.missing))process.exitCode=2;
