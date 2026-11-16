import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {loadCompanyCatalog} from '../history/company-register.mjs';
import {createDefaultProviderRegistry} from '../history/provider-registry.mjs';
import {providerRoute} from '../history/source-policy.mjs';
import {officialDailyStatus} from '../history/official-daily-status.mjs';
import {latestClosedWeekday,inspectDailyBarIntegrity,mapConcurrent} from './europe-run-policy.mjs';
const registry=createDefaultProviderRegistry();
const session=process.env.TARGET_SESSION||latestClosedWeekday();
assert(/^\d{4}-\d{2}-\d{2}$/.test(session)&&session<=latestClosedWeekday());
const market=process.env.MARKET_MIC;
const expected={XAMS:80,XBRU:105,XPAR:664};
assert(expected[market]);
const catalog=await loadCompanyCatalog(market);
assert.equal(catalog.shares.length,expected[market]);
const range={startDate:session,endDate:session};
const exact=r=>{const checked=inspectDailyBarIntegrity(r,range);return checked.conflicts.length===0&&checked.bars.length===1&&checked.bars[0].date===session?checked.bars[0]:null;};
const results=[];
await mapConcurrent(catalog.shares,4,async s=>{
 const instrument={...s,mic:s.primaryMic||s.mic||market,officialIsin:s.isin,ticker:s.symbol,currency:s.currency||'EUR'};
 const identity={isin:s.isin,mic:instrument.mic,symbol:s.symbol,name:s.name};
 let officialError=null;
 try{
 const official=await officialDailyStatus(instrument,session);
 const bar=official?.status==='TRADED'&&exact({bars:[official.bar]});
 if(bar){results.push({...identity,status:'TRADED',bar,provider:official.provider,sourceUrl:official.sourceUrl});return;}
 }catch(e){officialError=e.message;}
 try{
 const route=providerRoute(instrument,{mode:'update'});
 const {provider,result}=await registry.fetchDaily(instrument,range,route.primary,{allowedProviderIds:route.allowedProviderIds,timeoutMs:20000,acceptResult:r=>r.providerMeta?.partialHistory!==true&&Boolean(exact(r))});
 results.push({...identity,status:'TRADED',bar:exact(result),provider:provider.id,sourceUrl:result.requestUrl,officialError});
 }catch(e){results.push({...identity,status:'SESSION_UNVERIFIED',bar:null,officialError,error:e.message});}
});
assert.equal(results.length,expected[market]);
assert.equal(new Set(results.map(x=>x.isin)).size,expected[market]);
results.sort((a,b)=>a.isin.localeCompare(b.isin));
const counts={};for(const r of results)counts[r.status]=(counts[r.status]||0)+1;
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/daily-session-'+market+'.json',JSON.stringify({market,session,counts,readOnly:true,results},null,2)+'\n');
console.log('DAILY_SESSION '+JSON.stringify({market,session,counts}));
