import fs from 'node:fs/promises';
import {FactoryApiClient} from './client.mjs';
import {createDefaultProviderRegistry} from '../history/provider-registry.mjs';
import {partitionBars} from './history-format.mjs';
const client=new FactoryApiClient(),providers=createDefaultProviderRegistry();
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8')),sourceRegistry=JSON.parse(await fs.readFile('data/market-source-registry.json','utf8'));
const today=new Date().toISOString().slice(0,10),results=[];
// Verify factory credentials once before processing thousands of instruments.
try { await client.catalog(); } catch(error) {
 console.error('FACTORY_AUTH_PREFLIGHT_FAILED: productie-updates vereisen geldige Cloudflare factory-autorisatie: '+error.message);
 process.exit(3);
}
const manifestResponse=await fetch(client.baseUrl+'/api/history/manifest.json',{signal:AbortSignal.timeout(30000)});
if(!manifestResponse.ok)throw Error('Public manifest HTTP '+manifestResponse.status);
const manifest=(await manifestResponse.json()).instruments||{};
const freshnessCutoff=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
for(const market of plan.markets.filter(x=>x.state==='COMPLETE')){
 const source=sourceRegistry.markets?.[market.mic];if(!source||source.status!=='APPROVED')throw Error(`${market.mic}: COMPLETE zonder APPROVED bronroute`);
 const primary=source.historySources?.find(x=>x.role==='PRIMARY')?.provider;if(!primary)throw Error(`${market.mic}: geen PRIMARY bronroute`);
 const catalog=JSON.parse(await fs.readFile(`data/euronext-${market.code}.json`,'utf8')),shares=catalog.shares||catalog.instruments||[];
 const unavailable=new Set((market.dataUnavailable||[]).map(x=>x.isin));let advanced=0,current=0,skipped=0,failed=[];
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
   if(beforeDate&&afterDate>beforeDate)advanced++;else current++;
  }catch(e){failed.push({isin:s.isin,symbol:s.symbol||s.ticker,error:e.message})}
 }
 results.push({mic:market.mic,catalog:shares.length,advanced,current,skippedDataUnavailable:skipped,failed});
}
const report={generatedAt:new Date().toISOString(),mode:'APPEND_ONLY_STALE_AND_MISSING_COMPLETE_MARKETS',markets:results};await fs.mkdir('research/output',{recursive:true});await fs.writeFile('research/output/daily-open-close-update.json',JSON.stringify(report,null,2));console.log(JSON.stringify(results.map(x=>({...x,failed:x.failed.length})),null,2));if(results.some(x=>x.failed.length))process.exitCode=2;
