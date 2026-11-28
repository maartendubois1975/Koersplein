import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {loadCompanyCatalog,identityEventAt} from '../history/company-register.mjs';
import {marketSources,establishedMarkets} from '../history/market-definitions.mjs';
import {validateSnapshot} from './archive-approved-session.mjs';
import {createDefaultProviderRegistry} from '../history/provider-registry.mjs';
import {providerRoute} from '../history/source-policy.mjs';
import {officialDailyStatus} from '../history/official-daily-status.mjs';
import {inspectDailyBarIntegrity,mapConcurrent} from './europe-run-policy.mjs';
import {latestClosedSession,sessionCalendar} from '../history/trading-calendar.mjs';
import {listingIdentity,validSessionDate} from '../../daily-session-view.mjs';

export async function collectApprovedSession({market,session,now=new Date(),catalog,registry=createDefaultProviderRegistry(),official=officialDailyStatus,concurrency=4,priorSnapshot,sourceRegistry=marketSources}={}){
 session??=latestClosedSession(market,now);
 if(!validSessionDate(session)||session>now.toISOString().slice(0,10)||[0,6].includes(new Date(session+'T12:00:00Z').getUTCDay()))throw Error('Invalid or unclosed target session '+session);
 const calendar=sessionCalendar(market,session);
 if(calendar.open&&session>latestClosedSession(market,now))throw Error('Invalid or unclosed target session '+session);
 catalog??=await loadCompanyCatalog(market);
 const confirmed=new Map();
 if(priorSnapshot){
  if(priorSnapshot.session!==session)throw Error('PRIOR_SESSION_MISMATCH');
  for(const row of validateSnapshot(priorSnapshot,catalog,market).results){
   if(row.status!=='SESSION_UNVERIFIED')confirmed.set(row.isin,row);
  }
 }
 const range={startDate:session,endDate:session};
 const exact=result=>{const check=inspectDailyBarIntegrity(result,range);return !check.conflicts.length&&check.bars.length===1?check.bars[0]:null;};
 const results=[];
 await mapConcurrent(catalog.shares,concurrency,async share=>{
  const {storageKey,...identity}=listingIdentity(share,market,session);
  if(confirmed.has(identity.isin)){results.push(confirmed.get(identity.isin));return;}
  const instrument={...share,...identity,officialIsin:identity.isin,ticker:identity.symbol,currency:share.currency||catalog.currency||'EUR'};
  const event=identityEventAt(share.isin,session);
  if(event&&identity.isin!==event.newIsin){results.push({...identity,status:'SESSION_UNVERIFIED',bar:null,reasonCode:'IDENTITY_CHANGED',successorIsin:event.newIsin,effectiveDate:event.effectiveDate,error:'Successor series requires separate admission/price verification'});return;}
  if(!calendar.open){results.push({...identity,status:'MARKET_CLOSED',bar:null,evidence:{sourceUrl:calendar.sourceUrl,date:session,verification:'OFFICIAL_TRADING_CALENDAR'}});return;}
  let officialError=null,officialEvidence=null;
  try{
   const officialProvider=sourceRegistry.markets[market]?.officialDailyProvider;
   const status=establishedMarkets.has(market)||officialProvider?await official(instrument,session):null;
   if(officialProvider&&status&&status.provider!==officialProvider)throw Error('OFFICIAL_DAILY_PROVIDER_MISMATCH');
   officialEvidence=status;
   if(status?.date===session&&['NO_TRADES','MARKET_CLOSED'].includes(status.status)){
    results.push({...identity,status:status.status,bar:null,provider:status.provider,sourceUrl:status.sourceUrl,evidence:status});return;
   }
   const bar=status?.status==='TRADED'&&exact({bars:[status.bar]});
   if(bar){results.push({...identity,status:'TRADED',bar,provider:status.provider,sourceUrl:status.sourceUrl});return;}
  }catch(error){officialError=error.message;}
  try{
   const route=providerRoute(instrument,{mode:'update',sourceRegistry});
   const {provider,result}=await registry.fetchDaily(instrument,range,route.primary,{allowedProviderIds:route.allowedProviderIds,timeoutMs:20000,acceptResult:r=>r.providerMeta?.partialHistory!==true&&Boolean(exact(r))});
   results.push({...identity,status:'TRADED',bar:exact(result),provider:provider.id,sourceUrl:result.requestUrl,officialError});
  }catch(error){results.push({...identity,status:'SESSION_UNVERIFIED',bar:null,reasonCode:officialEvidence?.reasonCode||(officialError?'OFFICIAL_SOURCE_ERROR':'PROVIDER_DATA_UNAVAILABLE'),evidence:officialEvidence,officialError,error:error.message});}
 });
 if(results.length!==catalog.shares.length||new Set(results.map(x=>x.isin)).size!==catalog.shares.length)throw Error('Incomplete session universe '+market);
 results.sort((a,b)=>a.isin.localeCompare(b.isin));
 const counts={};for(const row of results)counts[row.status]=(counts[row.status]||0)+1;
 return {market,session,calendar,counts,readOnly:true,generatedAt:now.toISOString(),results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const market=process.env.MARKET_MIC,now=new Date(),session=process.env.TARGET_SESSION||latestClosedSession(market,now);
 if(!/^[A-Z0-9]{4}$/.test(market||'')||!validSessionDate(session))throw Error('INVALID_SESSION_ARCHIVE_IDENTITY');
 let priorSnapshot;
 try{priorSnapshot=JSON.parse(await fs.readFile('data/daily-sessions/'+market+'/'+session+'.json','utf8'));}
 catch(error){if(error.code!=='ENOENT')throw error;}
 const snapshot=await collectApprovedSession({market,session,now,priorSnapshot});
 await fs.mkdir('research/output',{recursive:true});
 await fs.writeFile('research/output/daily-session-'+snapshot.market+'.json',JSON.stringify(snapshot,null,2)+'\n');
 console.log('DAILY_SESSION '+JSON.stringify({market:snapshot.market,session:snapshot.session,counts:snapshot.counts}));
 if(snapshot.counts.SESSION_UNVERIFIED===snapshot.results.length)process.exitCode=1;
}
