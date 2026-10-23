// Explicit/manual Paris tail recovery: only existing, recorded XPAR history.
// No catalog seeding, no first-time history creation, no global provider fallback.
import fs from 'node:fs/promises';
import {FactoryApiClient} from './client.mjs';
import {createDefaultProviderRegistry} from '../history/provider-registry.mjs';
import {storageIdentityResolver} from './storage-identity.mjs';
import {validBars} from './europe-run-policy.mjs';
import {partitionBars} from './history-format.mjs';
import {hasRecordedHistory,parisHistoryEligible} from './paris-history-eligibility.mjs';
const mic=process.env.MARKET_MIC||'XPAR';
if(mic!=='XPAR')throw Error('This focused recovery is restricted to XPAR');
const policy=JSON.parse(await fs.readFile('config/paris-follow-policy.json','utf8'));
if(policy.mode!=='existing-history-only'||!policy.mics?.includes('XPAR'))throw Error('PARIS_EXISTING_HISTORY_ONLY_POLICY_REQUIRED');
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const market=plan.markets.find(m=>m.mic===mic&&m.state==='COMPLETE');
if(!market)throw Error('Approved complete Paris market missing');
const catalog=JSON.parse(await fs.readFile('data/euronext-'+market.code+'.json','utf8'));
const sourceRegistry=JSON.parse(await fs.readFile('data/market-source-registry.json','utf8'));
const source=sourceRegistry.markets?.[mic];
if(source?.status!=='APPROVED')throw Error('Paris approved history source missing');
const provider=createDefaultProviderRegistry();
const primary=source.historySources?.find(s=>s.role==='PRIMARY')?.provider;
if(!primary||!provider.get(primary))throw Error('Paris approved primary provider missing');
const allowedProviderIds=[primary,...(source.historySources||[]).filter(s=>['DISCOVERY_FALLBACK','FALLBACK'].includes(s.role)).map(s=>s.provider)].filter((id,index,array)=>id&&array.indexOf(id)===index&&provider.get(id));
const client=new FactoryApiClient();
const manifest=(await client.historyManifest()).instruments||{};
const factory=await client.catalog();
const resolve=storageIdentityResolver(factory.instruments||[],mic);
const cutoff=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
const today=new Date().toISOString().slice(0,10);
const results=[];
for(const share of (catalog.shares||[]).filter(s=>(s.mic||mic)===mic)){
 const symbol=share.symbol||share.ticker,stored=resolve({...share,mic});
 const entry=stored&&manifest[stored];
 if(!parisHistoryEligible(share,mic,policy,manifest,resolve)||!hasRecordedHistory(entry)){
  results.push({symbol,isin:share.isin,status:'BLOCKED_NO_RECORDED_EXISTING_HISTORY'});
  continue;
 }
 if(entry.lastDate>=cutoff)continue;
 if(!symbol||!share.isin){results.push({symbol,isin:share.isin,status:'BLOCKED_MISSING_OFFICIAL_IDENTITY'});continue;}
 try{
  const instrument={...share,isin:share.isin,officialIsin:share.isin,symbol,ticker:symbol,mic,currency:share.currency||market.currency};
  const startDate=new Date(new Date(entry.lastDate+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10);
  const range={startDate,endDate:today};
  const {provider:used,result}=await provider.fetchDaily(instrument,range,primary,{allowedProviderIds,timeoutMs:60000,acceptResult:r=>validBars(r,range).length>0});
  const bars=validBars(result,range);
  if(!bars.length)throw Error('NO_COMPLETE_APPROVED_PROVIDER_BARS');
  for(const [period,part] of partitionBars(bars))await client.putPartition(stored,period,{bars:part,provider:used.id,appendOnly:true});
  await client.completeHistory(stored,{provider:used.id});
  const checked=await client.historyCoverage(stored);
  const last=checked?.lastDate||checked?.coverage?.lastDate||null;
  results.push({symbol,isin:share.isin,stored,status:last&&last>entry.lastDate?'APPENDED_VERIFIED':'APPENDED_UNVERIFIED',bars:bars.length,lastDate:last,provider:used.id});
 }catch(error){results.push({symbol,isin:share.isin,stored,status:'FAILED',error:String(error.message).slice(0,350)});}
}
const summary={market:mic,at:new Date().toISOString(),policy:policy.mode,attempted:results.length,verified:results.filter(r=>r.status==='APPENDED_VERIFIED').length,blocked:results.filter(r=>r.status.startsWith('BLOCKED')).length,failed:results.filter(r=>r.status==='FAILED').length,results};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/paris-targeted-history-recovery.json',JSON.stringify(summary,null,2)+'\n');
if(summary.failed)process.exitCode=2;
console.log('PARIS_EXISTING_HISTORY_TAIL_RESULT',JSON.stringify({attempted:summary.attempted,verified:summary.verified,blocked:summary.blocked,failed:summary.failed}));
