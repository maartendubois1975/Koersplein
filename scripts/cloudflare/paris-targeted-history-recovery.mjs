import fs from 'node:fs/promises';
import {FactoryApiClient} from './client.mjs';
import {createDefaultProviderRegistry} from '../history/provider-registry.mjs';
import {storageIdentityResolver,newListingStorageKey} from './storage-identity.mjs';
import {validBars} from './europe-run-policy.mjs';
import {partitionBars} from './history-format.mjs';

const mic=process.env.MARKET_MIC||'XPAR';
if(mic!=='XPAR')throw Error('This focused recovery is restricted to XPAR');
const client=new FactoryApiClient();
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const market=plan.markets.find(m=>m.mic===mic);
const catalog=JSON.parse(await fs.readFile('data/euronext-'+market.code+'.json','utf8'));
const registry=JSON.parse(await fs.readFile('data/market-source-registry.json','utf8'));
const source=registry.markets?.[mic];
if(source?.status!=='APPROVED'||!source.historySources?.some(s=>s.role==='PRIMARY'))throw Error('Paris approved history source missing');
const preferred=source.historySources.find(s=>s.role==='PRIMARY').provider;
const manifest=(await client.historyManifest()).instruments||{};
let factory=await client.catalog();
let resolve=storageIdentityResolver(factory.instruments||[],mic);
const missing=(catalog.shares||[]).filter(s=>s.isin&&!resolve(s));
for(let i=0;i<missing.length;i+=25){
 const instruments=missing.slice(i,i+25).map(s=>({isin:newListingStorageKey(s,mic),mic:s.mic||mic,ticker:s.symbol||s.ticker,company:s.company||s.name||s.symbol,countryCode:market.country,currency:s.currency||market.currency}));
 await client.seedCatalog({markets:[],instruments,createOnly:true});
}
if(missing.length){factory=await client.catalog();resolve=storageIdentityResolver(factory.instruments||[],mic);}
console.log('PARIS_EXISTING_CATALOG_IDENTITY_REUSED_OR_SEEDED',JSON.stringify({seeded:missing.length}));
const provider=createDefaultProviderRegistry();
const cutoff=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
const results=[];
for(const share of catalog.shares||[]){
  const symbol=share.symbol||share.ticker,stored=resolve({...share,mic:share.mic||mic});
  const entry=stored&&manifest[stored];
  if(entry?.lastDate&&Number(entry.recordCount||entry.records||0)>0&&entry.lastDate>=cutoff)continue;
  if(!stored){results.push({symbol,isin:share.isin,status:'BLOCKED_NO_EXISTING_STORAGE_IDENTITY'});continue}
  if(!symbol||!share.isin){results.push({symbol,isin:share.isin,status:'BLOCKED_MISSING_OFFICIAL_IDENTITY'});continue}
  try{
    const instrument={...share,isin:share.isin,officialIsin:share.isin,symbol,ticker:symbol,mic:share.mic||mic,currency:market.currency,providerSymbol:share.providerSymbol||null};
    const range={startDate:'1990-01-01',endDate:new Date().toISOString().slice(0,10)};
    const {provider:used,result}=await provider.fetchDaily(instrument,range,preferred,{strictPreferred:false,timeoutMs:60000,acceptResult:r=>validBars(r,range).length>0});
    if(!result.bars.length)throw Error('EMPTY_PROVIDER_HISTORY');
    for(const [period,bars] of partitionBars(validBars(result,range)))await client.putPartition(stored,period,{bars,provider:used.id,appendOnly:true});
    await client.completeHistory(stored,{provider:used.id});
    const checked=await client.historyCoverage(stored);
    const last=checked?.lastDate||checked?.coverage?.lastDate||checked?.bars?.at?.(-1)?.date||null;
    results.push({symbol,isin:share.isin,stored,status:last?'WRITTEN_VERIFIED':'WRITTEN_UNVERIFIED',bars:result.bars.length,lastDate:last,provider:used.id});
  }catch(error){results.push({symbol,isin:share.isin,stored,status:'FAILED',error:String(error.message).slice(0,350)})}
}
const summary={market:mic,at:new Date().toISOString(),attempted:results.length,verified:results.filter(r=>r.status==='WRITTEN_VERIFIED').length,blocked:results.filter(r=>r.status.startsWith('BLOCKED')).length,failed:results.filter(r=>r.status==='FAILED').length,results};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/paris-targeted-history-recovery.json',JSON.stringify(summary,null,2)+'\n');
if(summary.verified===0)process.exitCode=2;
console.log('PARIS_TARGETED_HISTORY_RESULT',JSON.stringify({attempted:summary.attempted,verified:summary.verified,blocked:summary.blocked,failed:summary.failed}));
for(const row of results)console.log('PARIS_TARGETED_ITEM',JSON.stringify(row));
